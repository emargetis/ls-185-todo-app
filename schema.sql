/*
$ dropdb todo-lists
$ createdb todo-lists
$ psql -d todo-lists < schema.sql
$ psql -d todo-lists < lib/seed-data.sql
*/

CREATE TABLE users (
  username text PRIMARY KEY,
  password text NOT NULL
);

CREATE TABLE todolists (
  id serial PRIMARY KEY,
  title text NOT NULL UNIQUE,
  username text NOT NULL REFERENCES users(username) ON DELETE CASCADE
);

CREATE TABLE todos (
  id serial PRIMARY KEY,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  todolist_id integer NOT NULL REFERENCES todolists(id) ON DELETE CASCADE,
  username text NOT NULL REFERENCES users(username) ON DELETE CASCADE
);

