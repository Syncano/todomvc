/*jshint quotmark:false */
/*jshint white:false */
/*jshint trailing:false */
/*jshint newcap:false */
var app = app || {};
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

(function () {
	'use strict';

	var Utils = app.Utils;
	// Generic "model" object. You can use whatever
	// framework you want. For this application it
	// may not even be worth separating this logic
	// out, but we do this to demonstrate one way to
	// separate out parts of your application.
	app.TodoModel = function (key) {
		this.key = key;
		this.todos = [];

		server.getTodos().then(function(res) {
			this.todos = res.objects;
			this.inform();
			this.watch(undefined);
		}.bind(this));

		this.onChanges = [];
	};

	app.TodoModel.prototype.subscribe = function (onChange) {
		this.onChanges.push(onChange);
	};

	app.TodoModel.prototype.inform = function () {
		this.onChanges.forEach(function (cb) { cb(); });
	};

	app.TodoModel.prototype.addTodo = function (title) {
		var todo = {
			title: title,
			iscompleted: false
		};

		server.createTodo(todo).then(function (res) {
			this.inform();
		}.bind(this));
	};

	app.TodoModel.prototype.toggleAll = function (checked) {
		// Note: it's usually better to use immutable data structures since they're
		// easier to reason about and React works very well with them. That's why
		// we use map() and filter() everywhere instead of mutating the array or
		// todo items themselves.
		this.todos = this.todos.map(function (todo) {
			return Utils.extend({}, todo, {iscompleted: checked});
		});

		this.inform();
	};

	app.TodoModel.prototype.toggle = function (todoToToggle) {
		todoToToggle.iscompleted = !todoToToggle.iscompleted;
		server.updateTodo(todoToToggle).then(function(res) {
			this.inform();
		}.bind(this));
	};

	app.TodoModel.prototype.destroy = function (todo) {
		server.deleteTodo(todo);
		this.inform();
	};

	app.TodoModel.prototype.save = function (todoToSave, text) {
		this.todos = this.todos.map(function (todo) {
			return todo !== todoToSave ? todo : Utils.extend({}, todo, {title: text});
		});

		server.updateTodo(todoToSave);

		this.inform();
	};

	app.TodoModel.prototype.clearCompleted = function () {
		var completed = this.todos.map(function (todo) {
			if (todo.iscompleted) {
				return todo;
			}
		});

		completed.forEach(function (todo) {
			if (todo) {
				server.deleteTodo(todo);
			}
		});

		this.inform();
	};

	app.TodoModel.prototype.getIndex = function(id) {
		var todos = this.todos;
		var i = todos.length;

		while (i--) {
			if (todos[i].id === id) {
				return i;
			}
		}
	};

	app.TodoModel.prototype.watch = function (lastId) {
		var self = this;

		var realtime = syncano.channel('todo-list').watch();

	    realtime.on('create', function(res) {
			var todo = {
				id: res.id,
				title: res.title,
				iscompleted: res.iscompleted
			};

			self.todos.push(todo);

			self.inform();
	    });

	    realtime.on('update', function(res) {
			var i = self.getIndex(res.id);

			if (res.title) {
				self.todos[i].title = res.title;
			}

			if (typeof res.iscompleted != 'undefined') {
				self.todos[i].iscompleted = res.iscompleted;
			}

			if (res.title === "") {
				self.todos.splice(i, 1);
			}

			self.inform();
	    });

	    realtime.on('delete', function(res) {
			self.todos.splice(self.getIndex(res.id), 1);
			self.inform();
	    });

	    realtime.on('error', function(res) {
			console.log(res);
	    });
	};
})();
