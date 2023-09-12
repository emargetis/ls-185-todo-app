const { dbQuery } = require("./db-query");
const bcrypt = require("bcrypt");

module.exports = class PgPersistence {
  constructor(session) {
    this.username = session.username;
  }

  // Mark all todos in the specified todo list as done. Returns a promise that
  // resolves to `true` on success, `false` if the todo list doesn't exist. The
  // todo list ID must be numeric.
  async completeAllTodos(todoListId) {
    const COMPLETE_ALL = "UPDATE todos SET done = TRUE" +
                         " WHERE todolist_id = $1 AND NOT done" +
                         " AND username = $2";
    
    let result = await dbQuery(COMPLETE_ALL, todoListId, this.username);
    return result.rowCount > 0;
  }



  // Create a new todo list with the specified title and add it to the list of
  // todo lists. Returns `true` on success, `false` on failure. (At this time,
  // there are no known failure conditions.)
  async createTodoList(title) {
    const INSERT_TODOLIST = "INSERT INTO todolists (title)" +
                            " VALUES ($1, $2)"
    
    try {
      let result = await dbQuery(INSERT_TODOLIST, title, this.username); 
      return result.rows > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }



  // Create a new todo with the specified title and add it to the indicated todo
  // list. Returns a promise that resolves to `true` on success, `false` on
  // failure.
  async createTodo(todoListId, title) {
    const INSERT_TODO = "INSERT INTO todos (todolist_id, title, username)" +
                        " VALUES ($1, $2, $3)";
                        
    let result = await dbQuery(INSERT_TODO, todoListId, title, this.username);
    return result.rowCount > 0;
  }



  // Delete a todo list from the list of todo lists. Returns `true` on success,
  // `false` if the todo list doesn't exist. The ID argument must be numeric.
  async deleteTodoList(todoListId) {
    const DELETE_TODOLIST = "DELETE FROM todolists WHERE id = $1" +
                            " AND username = $2";
    
    let result = await dbQuery(DELETE_TODOLIST, todoListId, this.username);
    return result.rowCount > 0;
  }



  // Delete a todo from the specified todo list. Returns a promise that resolves
  // to `true` on success, `false` on failure.
  async deleteTodo(todoListId, todoId) {
    const DELETE_TODO = "DELETE FROM todos" +
                      " WHERE todolist_id = $1 AND id = $2" +
                      " AND username = $3";
                      
    let result = await dbQuery(DELETE_TODO, todoListId, todoId, this.username);
    return result.rowCount > 0;
  }

  

  // Does the todo list have any undone todos? Returns true if yes, false if no.
  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
  }



  // Are all of the todos in the todo list done? If the todo list has at least
  // one todo and all of its todos are marked as done, then the todo list is
  // done. Otherwise, it is undone.
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }



  // Returns a Promise that resolves to `true` if a todo list with the specified
  // title exists in the list of todo lists, `false` otherwise..
  async existsTodoListTitle(title) {
    const FIND_TODOLIST = "SELECT * FROM todolists WHERE title = $1" +
                          " AND username = $2";
    let result = await dbQuery(FIND_TODOLIST, title, this.username);
    
    return result.rowCount > 0;
  }



  // Set a new title for the specified todo list. Returns a promise that
  // resolves to `true` on success, `false` if the todo list wasn't found.
  async setTodoListTitle(todoListId, title) {
    const UPDATE_TITLE = "UPDATE todolists SET title = $1" +
                         " WHERE id = $2" +
                         " AND username = $3";

    let result = await dbQuery(UPDATE_TITLE, title, todoListId, this.username);
    return result.rowCount > 0;
  }



  // Returns `true` if `error` seems to indicate a `UNIQUE` constraint
  // violation, `false` otherwise.
  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }



  // Returns a copy of the todo list with the indicated ID. Returns `undefined`
  // if not found. Note that `todoListId` must be numeric.
  async loadTodoList(todoListId) {
    const FIND_TODOLIST = "SELECT * FROM todolists WHERE id = $1" +
                          " AND username = $2";
    const FIND_TODOS = "SELECT * FROM todos WHERE todolist_id = $1" +
                       " AND username = $2";
    
    let resultTodoList = await dbQuery(FIND_TODOLIST, todoListId, this.username);
    let resultTodos = await dbQuery(FIND_TODOS, todoListId, this.username);
    let resultBoth = await Promise.all([resultTodoList, resultTodos]);
    
    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;
    
    todoList.todos = resultBoth[1].rows;
    return todoList;
  }



  // Returns a copy of the indicated todo in the indicated todo list. Returns
  // `undefined` if either the todo list or the todo is not found. Note that
  // both IDs must be numeric.
  async loadTodo(todoListId, todoId) {
    const FIND_TODO = "SELECT * FROM todos WHERE todolist_id = $1 AND id = $2"
                      " AND username = $2";
    
    let result = await dbQuery(FIND_TODO, todoListId, todoId, this.username);
    return result.rows[0];
  }



  // Returns a promise that resolves to a sorted list of all the todo lists
  // together with their todos. The list is sorted by completion status and
  // title (case-insensitive). The todos in the list are unsorted.
  async sortedTodoLists() {
    const ALL_TODOLISTS = "SELECT * FROM todolists" +
                          "  WHERE username = $1" +
                          "  ORDER BY lower(title) ASC";
    const ALL_TODOS =     "SELECT * FROM todos" +
                          "  WHERE username = $1";
  
    let resultTodoLists = dbQuery(ALL_TODOLISTS, this.username);
    let resultTodos = dbQuery(ALL_TODOS, this.username);
    let resultBoth = await Promise.all([resultTodoLists, resultTodos]);
  
    let allTodoLists = resultBoth[0].rows;
    let allTodos = resultBoth[1].rows;
    if (!allTodoLists || !allTodos) return undefined;
  
    allTodoLists.forEach(todoList => {
      todoList.todos = allTodos.filter(todo => {
        return todoList.id === todo.todolist_id;
      });
    });
  
    return this._partitionTodoLists(allTodoLists);
  }



  // Returns a new list of todo lists partitioned by completion status.
  _partitionTodoLists(todoLists) {
    let undone = [];
    let done = [];

    todoLists.forEach(todoList => {
      if (this.isDoneTodoList(todoList)) {
        done.push(todoList);
      } else {
        undone.push(todoList);
      }
    });

    return undone.concat(done);
  }



  // Returns a copy of the list of todos in the indicated todo list by sorted by
  // completion status and title (case-insensitive).
  async sortedTodos(todoList) {
    const SORTED_TODOS = "SELECT * FROM todos" +
                         " WHERE todolist_id = $1 AND username = $2" + 
                         " ORDER BY done ASC, lower(title) ASC";

    let result = await dbQuery(SORTED_TODOS, todoList.id, this.username);
    return result.rows;
  }


 
  // Toggle a todo between the done and not done state. Returns a promise that
  // resolves to `true` on success, `false` if the todo list or todo doesn't
  // exist. The id arguments must both be numeric.
  async toggleDoneTodo(todoListId, todoId) {

    const TOGGLE_DONE = "UPDATE todos SET done = NOT done" +
                        " WHERE todolist_id = $1 AND id = $2" +
                        " AND username = $3";
    
    let result = await dbQuery(TOGGLE_DONE, todoListId, todoId, this.username);
    return result.rowCount > 0;
  }
  
  async authenticate(username, password) {
    const FIND_HASHED_PASSWORD = "SELECT password FROM users" +
                                 "  WHERE username = $1";

    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password);
  }


};