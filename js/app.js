/*global jQuery, Handlebars, Router */
jQuery(function ($) {
	'use strict';

	Handlebars.registerHelper('eq', function (a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;

	var syncano = new Syncano({
		apiKey: "b52cb72f9b01c614d882bc5712a3f32b97cb9001",
		instance: "todolist",
		userKey: "680405847ef8175e53ee7c834fd9e27ca6312d22"
	});

	var todos = new syncano.class('todo');
	var server = {
		getTodos: function() {
			var filter = {fields: {include: ['iscompleted', 'title', 'id']}};
			return todos.dataobject().list(filter);
		},
		createTodo: function(todo) {
			todo.channel = 'todo-list';
			todo.other_permissions = 'full';
			return todos.dataobject().add(todo);
		},
		updateTodo: function(todo) {
			return todos.dataobject(todo.id).update(todo);
		},
		deleteTodo: function(todo) {
			return todos.dataobject(todo.id).delete();
		}
	};

	var util = {
		pluralize: function (count, word) {
			return count === 1 ? word : word + 's';
		},
		store: function (namespace, data) {
			return localStorage.setItem(namespace, JSON.stringify(data));
		}
	};

	var App = {
		init: function () {
			var self = this;
			server.getTodos().then(function(res) {
				self.todos = res.objects;
				self.cacheElements();
				self.bindEvents();
				self.watch();
				new Router({
					'/:filter': function (filter) {
						this.filter = filter;
						this.render();
					}.bind(self)
				}).init('/all');
			});
		},
		cacheElements: function () {
			this.todoTemplate = Handlebars.compile($('#todo-template').html());
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.$todoApp = $('#todoapp');
			this.$header = this.$todoApp.find('#header');
			this.$main = this.$todoApp.find('#main');
			this.$footer = this.$todoApp.find('#footer');
			this.$newTodo = this.$header.find('#new-todo');
			this.$toggleAll = this.$main.find('#toggle-all');
			this.$todoList = this.$main.find('#todo-list');
			this.$count = this.$footer.find('#todo-count');
			this.$clearBtn = this.$footer.find('#clear-completed');
		},
		bindEvents: function () {
			var list = this.$todoList;
			this.$newTodo.on('keyup', this.create.bind(this));
			this.$toggleAll.on('change', this.toggleAll.bind(this));
			this.$footer.on('click', '#clear-completed', this.destroyCompleted.bind(this));
			list.on('change', '.toggle', this.toggle.bind(this));
			list.on('dblclick', 'label', this.edit.bind(this));
			list.on('keyup', '.edit', this.editKeyup.bind(this));
			list.on('focusout', '.edit', this.update.bind(this));
			list.on('click', '.destroy', this.destroy.bind(this));
		},
		render: function () {
			var todos = this.getFilteredTodos();
			this.$todoList.html(this.todoTemplate(todos));
			this.$main.toggle(todos.length > 0);
			this.$toggleAll.prop('checked', this.getActiveTodos().length === 0);
			this.renderFooter();
			this.$newTodo.focus();
			util.store('todos-jquery', this.todos);
		},
		renderFooter: function () {
			var todoCount = this.todos.length;
			var activeTodoCount = this.getActiveTodos().length;
			var template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),
				completedTodos: todoCount - activeTodoCount,
				filter: this.filter
			});

			this.$footer.toggle(todoCount > 0).html(template);
		},
		toggleAll: function (e) {
			var isChecked = $(e.target).prop('checked');
			this.todos.forEach(function (todo) {
				if ((isChecked && !todo.iscompleted) || (!isChecked && todo.iscompleted)) {
					todo.iscompleted = isChecked;
					server.updateTodo(todo);
				}
			});
		},
		getActiveTodos: function () {
			return this.todos.filter(function (todo) {
				return !todo.iscompleted;
			});
		},
		getCompletedTodos: function () {
			return this.todos.filter(function (todo) {
				return todo.iscompleted;
			});
		},
		getFilteredTodos: function () {
			if (this.filter === 'active') {
				return this.getActiveTodos();
			}

			if (this.filter === 'completed') {
				return this.getCompletedTodos();
			}

			return this.todos;
		},
		destroyCompleted: function () {
			var completed = this.getCompletedTodos();
			completed.forEach(function (todo) {
					server.deleteTodo(todo);
			});
			this.filter = 'all';
		},
		getIndex: function(id) {
			var todos = this.todos;
			var i = todos.length;

			while (i--) {
				if (todos[i].id === id) {
					return i;
				}
			}
		},
		indexFromEl: function (el) {
			var id = $(el).closest('li').data('id');
			return this.getIndex(id);
		},
		create: function (e) {
			var self = this
			var $input = $(e.target);
			var val = $input.val().trim();

			if (e.which !== ENTER_KEY || !val) {
				return;
			}

			var todo = {
				title: val,
				iscompleted: false
			};

			server.createTodo(todo).then(function(res) {
				$input.val('');
			});
		},
		toggle: function (e) {
			var self = this;
			var i = this.indexFromEl(e.target);
			this.todos[i].iscompleted = !this.todos[i].iscompleted
			server.updateTodo(this.todos[i]);
		},
		edit: function (e) {
			var $input = $(e.target).closest('li').addClass('editing').find('.edit');
			$input.val($input.val()).focus();
		},
		editKeyup: function (e) {
			if (e.which === ENTER_KEY) {
				e.target.blur();
			}

			if (e.which === ESCAPE_KEY) {
				$(e.target).data('abort', true).blur();
			}
		},
		update: function (e) {
			var el = e.target;
			var $el = $(el);
			var val = $el.val().trim();

			if ($el.data('abort')) {
				$el.data('abort', false);
				this.render();
				return;
			}

			var i = this.indexFromEl(el);

			if (val) {
				server.updateTodo(this.todos[i]);
			} else {
				server.deleteTodo(this.todos[i]);
			}
		},
		destroy: function (e) {
			var i = this.indexFromEl(e.target);
			server.deleteTodo(this.todos[i]);
		},
		watch: function (lastId) {
			var self = this;
			lastId = lastId;
			var filter;
			if (lastId) {
				filter = {lastId: lastId};
			}
			syncano.channel("todo-list").poll(filter)
			.then(function(res) {
				console.log(res);
				if (res !== undefined) {
					lastId = res.id;
					var action = res.action;
					if (action === "update") {
						var i = self.getIndex(res.payload.id);

						if (res.payload.title) {
							self.todos[i].title = res.payload.title;
						}

						if (res.payload.iscompleted || res.payload.iscompleted === false){
							self.todos[i].iscompleted = res.payload.iscompleted;
						}

						self.todos[i].revision = res.payload.revision;

						if(res.payload.title === "") {
							self.todos.splice(i, 1);
						}

						self.render();
					}
					if (action === "create"){

						var todo = {
							id: res.payload.id,
							title: res.payload.title,
							iscompleted: res.payload.iscompleted
						};

						self.todos.push(todo);

						self.render();
					}
					if (action === "delete"){
						self.todos.splice(self.getIndex(res.payload.id), 1);
						self.render();
					}
				}
				self.watch(lastId);
			})
			.catch(function(err) {
				console.log(err);
				self.watch(lastId);
			});
		}
	}

	App.init();
});
