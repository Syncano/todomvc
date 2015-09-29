/*global Vue, todoStorage */

(function (exports) {

	'use strict';

	var filters = {
		all: function (todos) {
			return todos;
		},
		active: function (todos) {
			return todos.filter(function (todo) {
				return !todo.iscompleted;
			});
		},
		completed: function (todos) {
			return todos.filter(function (todo) {
				return todo.iscompleted;
			});
		}
	};

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

	exports.app = new Vue({

		// the root element that will be compiled
		el: '.todoapp',

		// app state data
		data: {
			todos: [],//todoStorage.fetch(),
			newTodo: '',
			editedTodo: null,
			visibility: 'all'
		},

		// ready hook, watch todos change for data persistence
		ready: function () {
			var self = this;
			server.getTodos().then(function(res) {
				console.log(res.objects);
				self.todos = res.objects;
			});
			//watch function goes here
			this.watch();
		},

		// a custom directive to wait for the DOM to be updated
		// before focusing on the input field.
		// http://vuejs.org/guide/directives.html#Writing_a_Custom_Directive
		directives: {
			'todo-focus': function (value) {
				if (!value) {
					return;
				}
				var el = this.el;
				setTimeout(function () {
					el.focus();
				}, 0);
			}
		},

		// computed properties
		// http://vuejs.org/guide/computed.html
		computed: {
			filteredTodos: function () {
				return filters[this.visibility](this.todos);
			},
			remaining: function () {
				return filters.active(this.todos).length;
			},
			allDone: {
				get: function () {
					return this.remaining === 0;
				},
				set: function (value) {
					this.todos.forEach(function (todo) {
						todo.iscompleted = value;
					});
				}
			}
		},

		// methods that implement data logic.
		// note there's no DOM manipulation here at all.
		methods: {

			addTodo: function () {
				var self = this;

				var value = this.newTodo && this.newTodo.trim();
				if (!value) {
					return;
				}
				
				var todo = {
					title: value,
					iscompleted: false
				};

				server.createTodo(todo).then(function(res) {
					self.newTodo = '';
				});				
			},

			toggle: function (todo) {
				todo.iscompleted = !todo.iscompleted;
				server.updateTodo(todo);
			},

			removeTodo: function (todo) {
				server.deleteTodo(todo);
			},

			editTodo: function (todo) { //when you click on textbox
				this.beforeEditCache = todo.title;
				this.editedTodo = todo;
			},

			doneEdit: function (todo) { //when you blur on textbox
				if (!this.editedTodo) {
					return;
				}
				this.editedTodo = null;
				todo.title = todo.title.trim();
				if (!todo.title) {
					this.removeTodo(todo);
				} else {
					server.updateTodo(todo);
				}
			},

			cancelEdit: function (todo) {
				this.editedTodo = null;
				todo.title = this.beforeEditCache;
			},

			removeCompleted: function () {			
				this.todos.forEach(function (todo) {
					if (todo.iscompleted) {
						server.deleteTodo(todo);
					}
				});
			},

			getIndex: function (id) {
				var self = this;
				for (var i = 0; i < self.todos.length; i++) {
					if (self.todos[i].id === id) {
						return i;
					}
				}
			},

			watch: function () {
				var self = this;

				var realtime = syncano.channel('todo-list').watch();

				realtime.on('create', function(res) {
					self.todos.push({title: res.title, id: res.id, iscompleted: res.iscompleted});
				});

				realtime.on('update', function(res) {
					var i = self.getIndex(res.id);

					if (res.title) {
						self.todos[i].title = res.title;
					}

					if (res.iscompleted || res.iscompleted === false) {
						self.todos[i].iscompleted = res.iscompleted;
					}

					if (res.title === '') {
						self.todos.splice(i, 1);
					}
				});

				realtime.on('delete', function(res) {
					self.todos.splice(self.getIndex(res.id), 1)
				});

				realtime.on('error', function(res) {
					console.log(res);
				});
			}
		}
	});

})(window);
