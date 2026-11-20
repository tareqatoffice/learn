export interface Todo {
  id: string;
  title: string;
  done: boolean;
}

interface TodoStore {
  todos: Todo[];
  nextId: number;
}

const globalStore = globalThis as typeof globalThis & { __todoStore?: TodoStore };
const store: TodoStore = (globalStore.__todoStore ??= { todos: [{ id: "t0", title: "First todo", done: true }], nextId: 1 });

export function listTodos(): Todo[] {
  return [...store.todos];
}

export function getTodo(id: string): Todo | undefined {
  return store.todos.find((todo) => todo.id === id);
}

export function addTodo(title: string): Todo {
  const todo: Todo = { id: `t${store.nextId++}`, title, done: false };
  store.todos.push(todo);
  return todo;
}

export function deleteTodo(id: string): boolean {
  const before: number = store.todos.length;
  store.todos = store.todos.filter((todo) => todo.id !== id);
  return store.todos.length < before;
}
