# Speaking lessons: JavaScript core topics

Each lesson maps to the Admin → Speaking lesson form:

- **Title**: lesson title
- **Shadow text**: script for the shadowing task, about 720 words each, which is 5 minutes or a little more at a calm speaking pace of 140 words per minute. Record it or generate text-to-speech, then upload the audio.
- **Passage**: read-aloud text, about 250 words each, which is roughly 1.5 to 2 minutes.
- **Prompt**: record-and-review question (about 2 minutes, video on)

Suggested order: 1 Closure, 2 Event loop, 3 `this`, 4 Promises. Set status to published when ready.

---

## 1. Closure

**Title:** JavaScript closures

**Shadow text:**
Today I want to talk about closures. Closures are one of the most important ideas in JavaScript, and they are asked about in almost every interview. The good news is that the idea is simple, once you see it clearly.

Let us start with scope. Scope means the area of your code where a variable can be seen. In JavaScript, a function can see its own variables, and it can also see the variables of the place where it was written. We call this lexical scope. The word lexical just means that the position of the code in the file decides what it can see. It does not depend on where the function is called later.

Now, here is the key point. A closure is a function together with the variables from the place where it was created. The function remembers them, even after the outer function has finished running.

Let me explain this with an example. Imagine a function called makeCounter. Inside it, we create a variable called count and set it to zero. Then we return a small function. Every time that small function is called, it adds one to count and returns the new value. Now we call makeCounter and save the result in a variable called counter. The outer function is finished. Normally, its variables would disappear. But when we call counter the first time, we get one. The second time, we get two. The third time, we get three. The variable count is still alive. It lives inside the closure.

Why does this work? Because the inner function holds a reference to the scope where it was born. As long as the inner function exists, JavaScript keeps that scope in memory. So a closure is not a special syntax. It is simply what happens when a function uses variables from an outer scope, and then leaves that scope.

An important detail is that the variable is not copied. It is shared. If two functions are created in the same scope, they look at the same variable. If one function changes it, the other function sees the change. This is very powerful, but it can also surprise you.

Now let us talk about why closures are useful. The first use is private data. JavaScript objects do not have truly private variables in the old style, but closures can give you something very close. You keep the variable inside a function, and you only return the functions that are allowed to use it. Outside code cannot touch the variable directly. It can only go through your methods. This is how many modules and libraries hide their internal state.

The second use is function factories. A factory is a function that creates other functions. For example, you can write a function called multiplier that takes a number, and returns a new function that multiplies anything by that number. Then you can create a double function and a triple function from the same code. Each one remembers its own number.

The third use is callbacks and event handlers. When you attach a click handler inside a function, the handler can still use the variables from that function, even when the click happens much later. This is a closure at work, and you use it every day without noticing.

The fourth use is techniques like debounce, throttle, and memoization. A debounce function keeps a timer id in a closure. A memoize function keeps a cache object in a closure. In both cases, the state is hidden, and each call to the wrapper function can read and update it.

Now let me tell you about a famous mistake. Imagine a loop that runs from zero to two, and inside the loop you call setTimeout to print the loop variable after one second. If the loop uses var, you will see the number three printed three times. Why? Because var creates only one variable for the whole function. All three callbacks share it, and by the time they run, the loop is finished and the value is three. If you use let instead, JavaScript creates a new variable for each round of the loop. Each callback gets its own copy, and you see zero, one, and two. This is a perfect example of how closures capture variables, not values.

There is also a cost to think about. Because a closure keeps its outer scope alive, it can keep large objects in memory longer than you expect. For example, if a long living event handler uses a small value, but the scope also contains a huge array, the array may stay in memory. Modern engines are smart and often remove unused variables, but you should still be careful. When you do not need a listener anymore, remove it. When you do not need a cache anymore, clear it.

So how can you explain closures in an interview? Here is a short version. A closure is a function that remembers the variables from the scope where it was created, even after that scope has finished. It happens because of lexical scope. We use closures for private state, factories, callbacks, and utilities like debounce. And the common trap is the var loop problem, which we fix with let.

Finally, a tip for practice. Do not only read about closures. Write a counter, a private bank account, and a debounce function. Then explain each one out loud in simple words. If you can explain it clearly to a beginner, you understand it well enough for any interview. Thank you for listening, and keep practicing.

**Passage:**
In JavaScript, every function carries a reference to the scope where it was defined. This is called lexical scope. When an inner function uses a variable from its outer function, and then escapes that outer function, we get a closure.

The variable is not copied. It is shared. This means that two closures created in the same scope can see and change the same value. Because of this, a closure can keep private state. A counter function can hide its count variable, and only expose the methods that are allowed to change it.

Closures are also behind many everyday tools. Event handlers, timers, and callbacks all remember the variables around them. Utilities such as debounce, throttle, and memoize store a timer or a cache inside a closure, so that every call can reuse it.

A classic bug appears in loops that use var. Every callback shares the same loop variable, so after the loop ends, each one prints the same final number. Using let creates a fresh binding for each iteration, and each callback keeps its own value.

Finally, remember that a closure keeps its outer scope alive. If that scope holds a large object, memory may not be released. Remove listeners and clear caches when you no longer need them.

**Prompt:**
Explain what a closure is to a junior developer. Give one real example where you would use a closure, such as a counter, a private variable, or a debounce function. Then describe one common mistake, for example the var loop problem, and how you fix it.

---

## 2. Event loop

**Title:** The event loop

**Shadow text:**
Today we will talk about the event loop. If you want to understand asynchronous JavaScript, this is the most important topic. Promises, timers, fetch, and async await all depend on it.

Let us begin with a fact. JavaScript is single threaded. This means it has one call stack, and it can run only one piece of code at a time. If one function takes five seconds, nothing else can run during those five seconds. The page cannot respond to clicks, and it cannot update the screen.

But we know that real applications wait for many things. They wait for network responses, for timers, for user clicks, and for files. If JavaScript had to stop and wait for each of them, the page would freeze all the time. So how does it work? The answer is that JavaScript does not do the waiting itself. The environment does it. In the browser, this environment gives us Web APIs. In Node, it is provided by the runtime. These parts can wait in the background, and when they are ready, they tell JavaScript.

Let me describe the pieces one by one. First, the call stack. This is where functions run. When you call a function, it is added to the top of the stack. When it returns, it is removed. Synchronous code runs here, from top to bottom.

Second, the Web APIs. When you call setTimeout, the browser starts a timer. When you call fetch, the browser starts a network request. Your code does not wait. The function call returns immediately, and your program continues.

Third, the task queue, sometimes called the macrotask queue. When the timer finishes, the browser does not run your callback right away. It puts the callback into the task queue. The same happens for click events and message events.

Fourth, the microtask queue. This queue is for smaller, high priority jobs. Promise callbacks, such as then, catch, and finally, go here. The function queueMicrotask also puts jobs here. And the code after an await is scheduled as a microtask as well.

And finally, the event loop. It is a simple loop with a simple job. It watches the call stack. When the stack is empty, it takes the next job and puts it on the stack. But there is one rule that you must remember. After each task, the event loop runs all the microtasks, until the microtask queue is empty. Only then does it take the next task, and only then can the browser repaint the screen.

Now let us test this with a famous example. Imagine this code. First line, console log A. Second line, setTimeout with a callback that logs B, and a delay of zero. Third line, a resolved promise with a then that logs C. Fourth line, console log D.

What is the output? Let us walk through it. The first line runs, and we see A. The second line asks the browser to start a timer. The timer finishes almost immediately, but the callback goes to the task queue and must wait. The third line creates a promise that is already resolved, so the then callback goes to the microtask queue. The fourth line runs, and we see D. Now the call stack is empty. The event loop first checks the microtasks, and runs the callback that logs C. Then the microtask queue is empty, so it takes the next task, which logs B. The final order is A, D, C, B.

Many people think that a delay of zero means immediately. It does not. It means as soon as possible after the current code and all microtasks are finished. Also, browsers may add a small minimum delay, so timers are never exact.

Now think about what this means for real applications. First, long running synchronous code blocks everything. A heavy loop over a million items will freeze the page, because the event loop cannot continue. To solve this, you can split the work into smaller chunks and schedule them with setTimeout or requestIdleCallback. You can also move the work to a Web Worker, which runs in a separate thread.

Second, be careful with microtasks. Because the event loop runs all microtasks before moving on, a microtask that keeps creating new microtasks can starve the rest of the program. The page will never get a chance to render. This is rare, but it is good to know.

Third, async and await do not create new threads. An async function runs normally until the first await. Then it pauses, and the rest of the function is scheduled as a microtask when the promise settles. The code outside keeps running in the meantime.

To summarize in an interview, you can say this. JavaScript runs on one thread with a call stack. Asynchronous work is handled by the environment, and finished callbacks wait in queues. The event loop moves them to the stack when it is empty. Microtasks, like promise callbacks, always run before the next macrotask, like a timer. If you can say this clearly and predict the output of a small example, you will impress any interviewer. Thank you for listening, and keep practicing.

**Passage:**
The event loop is the mechanism that lets JavaScript do non-blocking work on a single thread. Synchronous code runs first, on the call stack. Asynchronous operations such as timers, network calls, and user events are handled by the host environment, not by the language itself.

When they complete, their callbacks wait in a task queue. Promise reactions and queueMicrotask callbacks wait in a separate microtask queue. The event loop checks whether the call stack is empty. If it is, it runs one task. After each task, the engine drains all microtasks, and only then does it move to the next task or repaint the screen.

Because of this order, a promise callback always runs before a setTimeout callback, even when the timer delay is zero. It also means that a long running loop blocks everything, including rendering and clicks.

To keep a page responsive, split heavy work into small chunks, or move it to a Web Worker. And remember that async and await do not create new threads. They only pause a function and resume it later as a microtask.

**Prompt:**
Walk me through what happens when this code runs: a console log, then a setTimeout with zero delay, then a promise resolve with a then callback, then another console log. Say the exact output order and explain why, using the words call stack, microtask queue, and task queue.

---

## 3. The `this` keyword

**Title:** How `this` works

**Shadow text:**
Today we will talk about the this keyword in JavaScript. This is one of the topics that confuses beginners the most, and it is also a favorite question in interviews. But there is a simple way to think about it. The value of this is decided by how a function is called, not by where it is written.

Let us keep that sentence in mind and go through the rules one by one. There are four main rules, and one special case for arrow functions.

The first rule is default binding. This happens when you call a plain function, with no object before it. In strict mode, this is undefined. In sloppy mode, this is the global object, which is window in the browser. Most modern code is in strict mode, for example inside modules and classes, so you will usually see undefined. This is the source of the common error, cannot read property of undefined.

The second rule is implicit binding. This happens when you call a function as a method of an object. For example, user dot greet. Here, the object before the dot becomes this. So inside greet, this is user, and you can read this dot name to get the name of the user. The rule looks at the call site. It does not matter where greet was defined.

This leads to a famous problem. Imagine you take the method out of the object and save it in a variable. Then you call the variable like a normal function. The object before the dot is gone, so this is now undefined. The same thing happens when you pass a method as a callback, for example to setTimeout or to an event listener. The function runs later, as a plain call, and this is lost.

The third rule is explicit binding. JavaScript gives you three tools to choose this by hand. The method call runs a function right away, with the this value you provide, followed by the normal arguments. The method apply is almost the same, but it takes the arguments as an array. The method bind does not run the function. It returns a new function with this fixed forever. So to fix our callback problem, we can write setTimeout, then user dot greet dot bind, with user inside.

The fourth rule is new binding. When you call a function with the new keyword, JavaScript creates a fresh empty object, links it to the prototype, runs the function with this pointing to that object, and returns it. That is how constructors and classes work. Inside a constructor, this dot name equals name means that you are adding a property to the new object.

If more than one rule applies, there is an order of priority. The new binding is the strongest. Then comes explicit binding. Then implicit binding. And the default binding is last.

Now let us talk about arrow functions, because they are different. An arrow function does not have its own this. It does not follow the four rules. Instead, it uses the this of the surrounding scope, at the place where it was written. This is called lexical this. Because of that, call, apply, and bind cannot change it either.

Why is this useful? Think about a method that starts a timer. Inside the method, this is the object. If you pass a normal function to setTimeout, this inside it will be lost. But if you pass an arrow function, it takes this from the method, and it works as you expect. This is why arrow functions are so popular for callbacks.

But arrow functions are not always the right choice. Do not use an arrow function as an object method, if you need this to be the object. Because the arrow function takes this from the outside, it will not point to your object. Also, do not use arrow functions as constructors, because they cannot be called with new.

In classes, there is another common situation. When you pass a class method as a callback, for example to a button click handler in React, you lose this. There are three ways to solve it. You can bind the method in the constructor. You can define the method as an arrow function property, which is a class field. Or you can wrap the call in an arrow function when you pass it. Each way is fine, and teams usually choose one style and keep it.

Let me give you a short checklist for an interview. When you see this, ask yourself these questions. Is the function called with new? Then this is the new object. Is it called with call, apply, or bind? Then this is the object you gave. Is it called as a method, with an object before the dot? Then this is that object. Is it an arrow function? Then look at the outer scope. Otherwise, this is undefined in strict mode, or the global object.

To summarize, this is not about where the function lives. It is about how the function is called. Learn the four rules and the arrow function exception, and you can explain almost any example. Practice by writing small examples and predicting the result before you run them. Thank you for listening, and keep practicing.

**Passage:**
There are four main rules for this. First, default binding: a plain function call gives undefined in strict mode, or the global object in sloppy mode. Second, implicit binding: when a function is called as a method, this is the object before the dot. Third, explicit binding: call, apply, and bind let you choose this directly. Fourth, new binding: a constructor call creates a fresh object and assigns it to this.

If several rules apply, the new binding wins, then explicit, then implicit, and the default comes last.

Arrow functions ignore all of these rules. They have no this of their own, and they use the this value of the scope where they were defined. This makes them a good choice for callbacks inside methods, such as timers and array helpers. But they are a poor choice for object methods and constructors.

A common bug happens when you pass a method as a callback. The function runs later as a plain call, so the object before the dot is gone, and this is lost. You can fix it with bind, with an arrow function wrapper, or with an arrow function class field.

When in doubt, look at the call site, not at the definition.

**Prompt:**
A teammate says: "My method works when I call it directly, but this is undefined when I pass it to setTimeout or an event handler." Explain why that happens and give two ways to fix it. Mention when you would choose an arrow function and when you would choose bind.

---

## 4. Promises

**Title:** Promises and async/await

**Shadow text:**
Today we will talk about promises and async await. Almost every JavaScript application talks to a server, reads a file, or waits for a timer. All of these take time. Promises are the standard way to describe work that will finish later.

Let us start with the problem. Before promises, we used callbacks. You passed a function to another function, and it was called when the work was done. This works for one step. But when you have several steps, one after another, the code moves further to the right with every level. People called this callback hell. It was hard to read, and error handling was painful, because you had to check for errors in every callback.

A promise is an object that represents a value that is not ready yet, but will be ready in the future. You can think of it as a receipt. You do not have the food yet, but you have a receipt that promises it will come, or that tells you why it could not.

A promise is always in one of three states. Pending means the work is still running. Fulfilled means the work finished successfully, and the promise has a value. Rejected means the work failed, and the promise has a reason, usually an error. Once a promise leaves the pending state, it is settled, and it can never change again. This makes promises predictable.

To create a promise, you use the Promise constructor and give it a function with two parameters, resolve and reject. You call resolve with the value when you succeed, and reject with an error when you fail. But in daily work, you more often use promises that already exist, for example the one returned by fetch.

To use the result, you attach handlers. The method then receives the value when the promise is fulfilled. The method catch receives the error when it is rejected. And the method finally runs in both cases, which is useful for cleanup, like hiding a loading spinner.

Here is the most important feature. Every then returns a new promise. So you can chain them. If a handler returns a normal value, the next then receives it. If a handler returns another promise, the chain waits for it, and then continues with its result. This is how we flatten the callback pyramid into a straight line of steps.

Error handling in a chain is simple. If any step throws an error, or returns a rejected promise, the chain skips all following then handlers, and jumps to the nearest catch. So you can place one catch at the end and handle every failure above it. Be careful, though. If you forget to return a promise inside a then, the chain will not wait for it. This is one of the most common bugs.

Now let us talk about async and await. These keywords are built on top of promises. They do not replace them. They just give you a cleaner way to write them. When you put async before a function, that function always returns a promise. If you return a value, it is wrapped in a fulfilled promise. If you throw an error, it becomes a rejected promise.

Inside an async function, you can use await before a promise. The function pauses at that line until the promise settles, and then it continues with the result. If the promise is rejected, await throws the error, and you can handle it with try and catch. The important point is that only this function pauses. The rest of the program continues to run, because the pause is handled by the event loop. It does not block the thread.

This is where many developers make a performance mistake. Imagine you need to load a user, their posts, and their comments, and these three requests do not depend on each other. If you await them one by one, the total time is the sum of all three. Instead, you can start all of them first, and then wait for all of them together with Promise all. Then the total time is only the time of the slowest request.

JavaScript gives us four helpers for working with many promises. Promise all waits for every promise to be fulfilled, and rejects immediately if any one fails. Promise all settled waits for every promise to finish, whether it succeeds or fails, and gives you a report for each one. This is useful when partial results are acceptable. Promise race settles as soon as the first promise settles, either with success or failure. It is often used to add a timeout. And Promise any resolves with the first promise that succeeds, and only rejects if all of them fail. It is useful when you have several servers and you want the fastest answer.

There are a few more pitfalls to remember. Do not use await inside a forEach callback and expect it to wait, because forEach does not understand promises. Use a for of loop, or Promise all with map. Do not forget to handle rejections, because an unhandled rejection can crash a Node process or hide a failure in the browser. And do not wrap a promise in a new Promise without a good reason, because it adds noise and bugs.

To summarize, a promise is a placeholder for a future value, with three states and a one time result. Then and catch let us chain and handle errors. Async and await give us a cleaner syntax on top of the same idea. And for independent work, use Promise all to run tasks in parallel. If you can explain these points and write a small example without looking, you are ready for this topic in an interview. Thank you for listening, and keep practicing.

**Passage:**
Before promises, asynchronous code used nested callbacks, which were hard to read and hard to handle errors in. Promises flatten that structure. A promise starts pending and ends either fulfilled with a value or rejected with a reason. Once it settles, it never changes.

Chaining with then lets us transform results step by step. If any step throws an error, the chain jumps to the nearest catch, so a single catch at the end handles every failure above it. The finally method runs in both cases and is good for cleanup.

With async and await, we can write asynchronous code that looks synchronous. An async function always returns a promise, and await pauses only that function until the promise settles. We use try and catch for errors.

One common mistake is awaiting tasks one by one when they are independent. Use Promise all to start them together and save time. Use Promise all settled when you want every result, even if some fail. Use Promise race for a timeout, and Promise any to take the first success.

**Prompt:**
Explain the difference between Promise all, Promise all settled, Promise race, and Promise any. Give a short real-world use case for two of them. Then explain how error handling differs between then and catch chains and async await with try and catch.
