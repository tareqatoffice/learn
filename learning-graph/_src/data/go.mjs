// id, tr (track key), t (title, <=22 chars), pre (prerequisite ids), s (summary), p (key points), c (code), pit (common mistake), u (docs URL)
export default {
  "out": "go_learning_graph",
  "title": "Go Learning Graph",
  "sub": "Targets Go 1.25 and later; topics that need a newer minimum version say so.",
  "foot": "Links go to the official Go documentation on go.dev and pkg.go.dev. Each major Go release is supported until two newer major releases exist\n    (<a href=\"https://go.dev/doc/devel/release#policy\">Go release policy</a>).",
  "key": "go-learning-graph-v1",
  "tracks": [
    { "k": "basics", "n": "Basics" },
    { "k": "types", "n": "Types & methods" },
    { "k": "errors", "n": "Errors & idioms" },
    { "k": "conc", "n": "Concurrency" },
    { "k": "tools", "n": "Tooling & testing" },
    { "k": "svc", "n": "Services" }
  ],
  "nodes": [
    {
      "id": "modules",
      "tr": "basics",
      "t": "Modules & go command",
      "pre": [],
      "s": "A module is a tree of packages with a go.mod file at its root. The go command builds, tests, and fetches dependencies based on that file.",
      "p": [
        "go mod init creates go.mod with the module path and the go version line.",
        "go get adds or upgrades a dependency; go mod tidy removes unused ones and adds missing ones.",
        "go.sum records checksums so every teammate builds the exact same dependency code."
      ],
      "c": "$ go mod init example.com/orders\n$ go get github.com/google/uuid@latest\n$ go mod tidy\n$ go build ./...\n$ go test ./...\n$ go run ./cmd/api",
      "pit": "Not committing go.sum, or editing go.mod by hand and skipping go mod tidy, leaves builds that differ between machines.",
      "u": "https://go.dev/ref/mod"
    },
    {
      "id": "packages",
      "tr": "basics",
      "t": "Packages & visibility",
      "pre": ["modules"],
      "s": "Every Go file belongs to a package, and a directory is one package. A name is exported when it starts with an uppercase letter; there are no public or private keywords.",
      "p": [
        "Import paths are the module path plus the directory, for example example.com/orders/store.",
        "Packages under an internal/ directory can only be imported by code rooted at internal's parent.",
        "Import cycles are a compile error, so keep dependencies pointing one way."
      ],
      "c": "package store\n\n// Order is exported: other packages can use it.\ntype Order struct {\n    ID    string\n    total int // unexported: only package store sees it\n}\n\nfunc New(id string) *Order { return &Order{ID: id} }",
      "pit": "Naming a package util or common turns it into a dumping ground; name packages after what they provide.",
      "u": "https://go.dev/doc/code"
    },
    {
      "id": "types",
      "tr": "basics",
      "t": "Types & zero values",
      "pre": [],
      "s": "Go is statically typed, and every variable starts at its type's zero value: 0, false, \"\", or nil. Good Go types are designed so the zero value is useful.",
      "p": [
        "var declares with the zero value; := declares and infers the type inside functions.",
        "There are no implicit numeric conversions: int and int64 need an explicit conversion.",
        "Constants are untyped until used, so const big = 1 << 40 works in many contexts."
      ],
      "c": "var count int          // 0\nvar name string        // \"\"\nvar ready bool         // false\n\nlimit := 10            // int, inferred\nratio := float64(count) / float64(limit)\nfmt.Println(count, name == \"\", ready, ratio)",
      "pit": "Using := inside an if or for block shadows an outer variable with the same name instead of assigning to it.",
      "u": "https://go.dev/ref/spec#The_zero_value"
    },
    {
      "id": "control",
      "tr": "basics",
      "t": "Control flow",
      "pre": ["types"],
      "s": "Go has if, switch, and a single loop keyword, for. if and switch can run a short statement first, which keeps the scope of temporary values small.",
      "p": [
        "for covers classic loops, while-style loops, infinite loops, and range.",
        "switch cases do not fall through by default and can use any expression.",
        "Since Go 1.22, each loop iteration gets its own copy of the loop variable."
      ],
      "c": "if n, err := strconv.Atoi(s); err == nil && n > 0 {\n    fmt.Println(\"positive\", n)\n}\n\nfor i := range 3 { // range over int, Go 1.22+\n    fmt.Println(i)\n}\n\nswitch {\ncase score >= 90:\n    grade = \"A\"\ndefault:\n    grade = \"B\"\n}",
      "pit": "A break inside a switch or select only leaves that statement, not the surrounding for loop; use a labeled break.",
      "u": "https://go.dev/doc/effective_go#control-structures"
    },
    {
      "id": "funcs",
      "tr": "basics",
      "t": "Functions & closures",
      "pre": ["control"],
      "s": "Functions can return several values, which is how Go returns a result and an error together. Functions are values, and function literals close over variables around them.",
      "p": [
        "Multiple returns: func f() (int, error) is the standard shape for fallible work.",
        "Variadic parameters use ...T and receive a slice.",
        "A closure captures variables by reference, not by value."
      ],
      "c": "func counter() func() int {\n    n := 0\n    return func() int {\n        n++\n        return n\n    }\n}\n\nnext := counter()\nfmt.Println(next(), next()) // 1 2",
      "pit": "Named result parameters with a bare return make long functions hard to read; use them only for short functions or deferred error handling.",
      "u": "https://go.dev/ref/spec#Function_literals"
    },
    {
      "id": "slices",
      "tr": "basics",
      "t": "Slices",
      "pre": ["control"],
      "s": "A slice is a small header with a pointer to an array, a length, and a capacity. Slicing shares the backing array, and append reuses it while capacity allows.",
      "p": [
        "len is how many elements are visible; cap is how many fit before append must reallocate.",
        "Always use the result of append: s = append(s, x).",
        "The slices package (Go 1.21+) has Sort, Contains, Index, Clone and more."
      ],
      "c": "a := []int{1, 2, 3, 4}\nb := a[:2]          // len 2, cap 4, shares a's array\nb = append(b, 99)   // overwrites a[2]!\nfmt.Println(a)      // [1 2 99 4]\n\nc := slices.Clone(a[:2])\nc = append(c, 7)    // a is untouched",
      "pit": "Appending to a sub-slice silently overwrites the parent's elements when capacity remains; clone or use a full slice expression a[:2:2].",
      "u": "https://go.dev/blog/slices-intro"
    },
    {
      "id": "maps",
      "tr": "basics",
      "t": "Maps",
      "pre": ["slices"],
      "s": "A map is a built-in hash table. Reading a missing key returns the zero value, and the comma-ok form tells you whether the key was present.",
      "p": [
        "A nil map can be read but writing to it panics; create maps with make or a literal.",
        "Iteration order is unspecified and deliberately varies between runs.",
        "The maps package (Go 1.21+) has Keys, Values, Clone and more."
      ],
      "c": "stock := map[string]int{\"apple\": 3}\nstock[\"pear\"] += 2           // missing key reads as 0\n\nif n, ok := stock[\"kiwi\"]; !ok {\n    fmt.Println(\"no kiwi\", n)\n}\n\ndelete(stock, \"apple\")\nkeys := slices.Sorted(maps.Keys(stock))",
      "pit": "Maps are not safe for concurrent writes; unsynchronized access from goroutines can crash with a fatal error.",
      "u": "https://go.dev/blog/maps"
    },
    {
      "id": "strings",
      "tr": "basics",
      "t": "Strings & runes",
      "pre": ["slices"],
      "s": "A string is an immutable sequence of bytes, usually UTF-8. Indexing gives a byte; ranging gives runes (Unicode code points).",
      "p": [
        "len(s) counts bytes, not characters; use utf8.RuneCountInString for characters.",
        "Build strings in a loop with strings.Builder, not repeated +.",
        "Converting between string and []byte copies the data."
      ],
      "c": "s := \"héllo\"\nfmt.Println(len(s))                    // 6 bytes\nfmt.Println(utf8.RuneCountInString(s)) // 5 runes\n\nfor i, r := range s {\n    fmt.Printf(\"%d:%c \", i, r)\n}\n\nvar sb strings.Builder\nsb.WriteString(\"id=\")\nsb.WriteString(strconv.Itoa(42))",
      "pit": "Slicing s[:n] on non-ASCII text can cut a multi-byte character in half and produce invalid UTF-8.",
      "u": "https://go.dev/blog/strings"
    },
    {
      "id": "structs",
      "tr": "types",
      "t": "Structs",
      "pre": ["types", "packages"],
      "s": "A struct groups named fields into one type. Structs are values: assigning or passing one copies every field.",
      "p": [
        "Use keyed literals (Order{ID: \"a\"}) so adding fields does not break callers.",
        "Unset fields get their zero values.",
        "Struct tags such as `json:\"id\"` are metadata read by packages like encoding/json."
      ],
      "c": "type Order struct {\n    ID    string\n    Items []string\n    Paid  bool\n}\n\no := Order{ID: \"A1\"}\ncopyOf := o          // full copy of the struct\ncopyOf.Paid = true\nfmt.Println(o.Paid)  // false",
      "pit": "Copying a struct copies slice and map headers, not their contents, so both copies still share the same items.",
      "u": "https://go.dev/ref/spec#Struct_types"
    },
    {
      "id": "pointers",
      "tr": "types",
      "t": "Pointers",
      "pre": ["structs"],
      "s": "A pointer holds the address of a value. Use one when a function must modify its argument, or when copying a large struct is wasteful.",
      "p": [
        "&x takes an address; *p reads or writes through it. There is no pointer arithmetic.",
        "p.Field works directly on a struct pointer; Go dereferences for you.",
        "Returning a pointer to a local variable is safe; escape analysis moves it to the heap."
      ],
      "c": "func markPaid(o *Order) {\n    o.Paid = true\n}\n\no := Order{ID: \"A1\"}\nmarkPaid(&o)\nfmt.Println(o.Paid) // true\n\nvar p *Order\n// p.Paid = true  // would panic: nil pointer dereference",
      "pit": "Dereferencing a nil pointer panics at runtime; check for nil at boundaries where a pointer may be absent.",
      "u": "https://go.dev/tour/moretypes/1"
    },
    {
      "id": "methods",
      "tr": "types",
      "t": "Methods & receivers",
      "pre": ["pointers", "funcs"],
      "s": "A method is a function with a receiver. A value receiver works on a copy; a pointer receiver can modify the original.",
      "p": [
        "Use pointer receivers when the method mutates state or the struct is large.",
        "Keep receivers consistent: if one method needs a pointer, make them all pointers.",
        "Methods can be declared on any named type defined in the same package, not only structs."
      ],
      "c": "type Cart struct{ items []string }\n\nfunc (c *Cart) Add(item string) { c.items = append(c.items, item) }\nfunc (c *Cart) Len() int        { return len(c.items) }\n\ntype Celsius float64\n\nfunc (t Celsius) String() string { return fmt.Sprintf(\"%.1f°C\", float64(t)) }",
      "pit": "A value receiver that modifies a field changes only a copy, so the caller never sees the update.",
      "u": "https://go.dev/doc/effective_go#methods"
    },
    {
      "id": "interfaces",
      "tr": "types",
      "t": "Interfaces",
      "pre": ["methods"],
      "s": "An interface is a set of methods. A type satisfies it implicitly, just by having those methods. Small interfaces like io.Reader are the Go norm.",
      "p": [
        "Define interfaces where they are used (the consumer), not next to the implementation.",
        "Accept interfaces, return concrete types.",
        "An interface value holds a type and a value; it is nil only when both are nil."
      ],
      "c": "type Notifier interface {\n    Notify(msg string) error\n}\n\ntype Email struct{ To string }\n\nfunc (e Email) Notify(msg string) error {\n    fmt.Println(\"mail to\", e.To, msg)\n    return nil\n}\n\nvar n Notifier = Email{To: \"team@example.com\"}",
      "pit": "Returning a nil *MyErr as an error gives a non-nil interface, so err != nil is true; return a literal nil instead.",
      "u": "https://go.dev/doc/effective_go#interfaces"
    },
    {
      "id": "embedding",
      "tr": "types",
      "t": "Embedding",
      "pre": ["interfaces"],
      "s": "Embedding a type in a struct promotes its fields and methods to the outer type. It is composition, not inheritance: there is no override or virtual dispatch.",
      "p": [
        "Embedding a sync.Mutex or an interface is a common, compact pattern.",
        "Interfaces can embed other interfaces, like io.ReadWriter.",
        "An outer method with the same name shadows the promoted one."
      ],
      "c": "type Logger struct{ prefix string }\n\nfunc (l Logger) Log(msg string) { fmt.Println(l.prefix, msg) }\n\ntype Service struct {\n    Logger // embedded: Service gets Log\n    name   string\n}\n\ns := Service{Logger: Logger{\"[svc]\"}, name: \"orders\"}\ns.Log(\"started\")",
      "pit": "Embedding a type in an exported struct also exports all its methods, which can leak internals into your public API.",
      "u": "https://go.dev/doc/effective_go#embedding"
    },
    {
      "id": "generics",
      "tr": "types",
      "t": "Generics",
      "pre": ["interfaces", "slices"],
      "s": "Type parameters (Go 1.18+) let functions and types work over many types while staying type-checked. Constraints are interfaces that list allowed types or methods.",
      "p": [
        "any means no constraint; comparable allows == and !=; cmp.Ordered allows < and >.",
        "Type arguments are usually inferred from the call.",
        "Reach for generics for containers and algorithms, not as a default for every function."
      ],
      "c": "func Map[T, U any](in []T, f func(T) U) []U {\n    out := make([]U, 0, len(in))\n    for _, v := range in {\n        out = append(out, f(v))\n    }\n    return out\n}\n\nids := Map([]int{1, 2}, strconv.Itoa) // []string{\"1\", \"2\"}",
      "pit": "Using generics where a plain interface would do adds complexity without benefit; start concrete and generalize later.",
      "u": "https://go.dev/doc/tutorial/generics"
    },
    {
      "id": "iterators",
      "tr": "types",
      "t": "Iterators",
      "pre": ["generics"],
      "s": "Since Go 1.23, for range accepts functions of the shape func(yield func(V) bool). The iter package names these types Seq and Seq2.",
      "p": [
        "The iterator calls yield for each element and stops when yield returns false.",
        "slices.All, slices.Values, and maps.Keys return iterators.",
        "Iterators let you stream values without building an intermediate slice."
      ],
      "c": "func Evens(max int) iter.Seq[int] {\n    return func(yield func(int) bool) {\n        for i := 0; i <= max; i += 2 {\n            if !yield(i) {\n                return\n            }\n        }\n    }\n}\n\nfor n := range Evens(6) {\n    fmt.Println(n) // 0 2 4 6\n}",
      "pit": "Ignoring yield's false result and continuing the loop makes the program panic when the caller breaks out early.",
      "u": "https://go.dev/blog/range-functions"
    },
    {
      "id": "errors",
      "tr": "errors",
      "t": "Errors as values",
      "pre": ["interfaces"],
      "s": "error is a built-in interface with one method, Error() string. Functions return an error as their last result, and callers check it right away.",
      "p": [
        "Check err immediately and return early; keep the happy path unindented.",
        "Create simple errors with errors.New or fmt.Errorf.",
        "Sentinel errors are package-level values, like io.EOF, that callers can compare against."
      ],
      "c": "var ErrNotFound = errors.New(\"order not found\")\n\nfunc Find(id string) (*Order, error) {\n    o, ok := orders[id]\n    if !ok {\n        return nil, ErrNotFound\n    }\n    return o, nil\n}",
      "pit": "Ignoring an error with _ hides failures; if you truly do not care, leave a comment saying why.",
      "u": "https://go.dev/blog/error-handling-and-go"
    },
    {
      "id": "wrapping",
      "tr": "errors",
      "t": "Wrapping errors",
      "pre": ["errors"],
      "s": "fmt.Errorf with %w wraps an error with context while keeping the original. errors.Is matches a value in the chain; errors.As finds an error of a given type.",
      "p": [
        "Add context at each layer: fmt.Errorf(\"load order %s: %w\", id, err).",
        "errors.Is(err, ErrNotFound) works through any number of wraps.",
        "errors.Join (Go 1.20+) combines several errors into one."
      ],
      "c": "o, err := store.Find(id)\nif err != nil {\n    return fmt.Errorf(\"checkout %s: %w\", id, err)\n}\n\n// caller\nif errors.Is(err, store.ErrNotFound) {\n    http.Error(w, \"not found\", http.StatusNotFound)\n}\nvar pe *fs.PathError\nif errors.As(err, &pe) {\n    log.Println(\"bad path:\", pe.Path)\n}",
      "pit": "Comparing with err == ErrNotFound fails once the error is wrapped; use errors.Is.",
      "u": "https://go.dev/blog/go1.13-errors"
    },
    {
      "id": "defer",
      "tr": "errors",
      "t": "Defer, panic, recover",
      "pre": ["funcs", "errors"],
      "s": "defer schedules a call to run when the function returns, which keeps cleanup next to setup. panic stops normal flow; recover inside a deferred function can stop a panic.",
      "p": [
        "Deferred calls run in last-in, first-out order, even when the function panics.",
        "Arguments to a deferred call are evaluated when defer runs, not when the call happens.",
        "Use panic only for programmer bugs; return errors for expected failures."
      ],
      "c": "func readConfig(path string) ([]byte, error) {\n    f, err := os.Open(path)\n    if err != nil {\n        return nil, err\n    }\n    defer f.Close()\n    return io.ReadAll(f)\n}",
      "pit": "defer inside a loop does not run until the whole function returns, so files or locks pile up; move the loop body into its own function.",
      "u": "https://go.dev/blog/defer-panic-and-recover"
    },
    {
      "id": "goroutines",
      "tr": "conc",
      "t": "Goroutines",
      "pre": ["funcs"],
      "s": "A goroutine is a function running concurrently, started with the go keyword. Goroutines are cheap, but every one you start needs a clear way to finish.",
      "p": [
        "main returning ends the program, even if goroutines are still running.",
        "Goroutines share memory, so shared data needs channels or locks.",
        "Know who stops each goroutine and when; leaks are a common production issue."
      ],
      "c": "done := make(chan struct{})\n\ngo func() {\n    defer close(done)\n    fmt.Println(\"working in background\")\n}()\n\n<-done // wait for the goroutine to finish",
      "pit": "Starting a goroutine that blocks forever on a channel nobody reads leaks memory for the life of the process.",
      "u": "https://go.dev/doc/effective_go#goroutines"
    },
    {
      "id": "channels",
      "tr": "conc",
      "t": "Channels",
      "pre": ["goroutines"],
      "s": "A channel passes values between goroutines and synchronizes them. Unbuffered channels hand off directly; buffered channels queue up to their capacity.",
      "p": [
        "Only the sender closes a channel, and only to signal that no more values will come.",
        "range over a channel reads until it is closed.",
        "Directional types (chan<- T, <-chan T) document who sends and who receives."
      ],
      "c": "func produce(n int) <-chan int {\n    out := make(chan int)\n    go func() {\n        defer close(out)\n        for i := range n {\n            out <- i\n        }\n    }()\n    return out\n}\n\nfor v := range produce(3) {\n    fmt.Println(v)\n}",
      "pit": "Sending on a closed channel panics, and closing a channel twice panics; let exactly one owner close it.",
      "u": "https://go.dev/doc/effective_go#channels"
    },
    {
      "id": "select",
      "tr": "conc",
      "t": "Select",
      "pre": ["channels"],
      "s": "select waits on several channel operations and runs whichever is ready first. It is how you add timeouts, cancellation, and non-blocking sends.",
      "p": [
        "If several cases are ready, one is chosen at random.",
        "A default case makes the select non-blocking.",
        "A nil channel never becomes ready, which lets you switch cases off."
      ],
      "c": "select {\ncase msg := <-inbox:\n    handle(msg)\ncase <-ctx.Done():\n    return ctx.Err()\ncase <-time.After(2 * time.Second):\n    return errors.New(\"timed out\")\n}",
      "pit": "Calling time.After inside a tight loop creates a new timer each iteration; reuse a time.Timer or rely on a context deadline.",
      "u": "https://go.dev/ref/spec#Select_statements"
    },
    {
      "id": "sync",
      "tr": "conc",
      "t": "sync package",
      "pre": ["goroutines", "pointers"],
      "s": "The sync package has the low-level tools: Mutex and RWMutex guard shared data, WaitGroup waits for goroutines, and Once runs setup exactly once.",
      "p": [
        "Lock, then defer Unlock, so every return path releases the lock.",
        "WaitGroup.Go (Go 1.25+) starts a goroutine and handles Add and Done for you.",
        "sync/atomic covers simple counters and flags without a mutex."
      ],
      "c": "type Counter struct {\n    mu sync.Mutex\n    n  map[string]int\n}\n\nfunc (c *Counter) Inc(key string) {\n    c.mu.Lock()\n    defer c.mu.Unlock()\n    c.n[key]++\n}\n\nvar wg sync.WaitGroup\nfor _, k := range keys {\n    wg.Go(func() { c.Inc(k) })\n}\nwg.Wait()",
      "pit": "Copying a struct that contains a Mutex copies the lock state; pass such structs by pointer (go vet flags this).",
      "u": "https://pkg.go.dev/sync"
    },
    {
      "id": "context",
      "tr": "conc",
      "t": "Context",
      "pre": ["select", "wrapping"],
      "s": "context.Context carries deadlines, cancellation, and request-scoped values across API boundaries. Pass it as the first parameter, named ctx.",
      "p": [
        "WithTimeout and WithCancel return a cancel function; always call it, usually with defer.",
        "Long-running work should check ctx.Done() or pass ctx to calls that do.",
        "Use context values only for request-scoped data like trace IDs, not for optional parameters."
      ],
      "c": "func fetch(ctx context.Context, url string) (*http.Response, error) {\n    ctx, cancel := context.WithTimeout(ctx, 3*time.Second)\n    defer cancel()\n\n    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)\n    if err != nil {\n        return nil, err\n    }\n    return http.DefaultClient.Do(req)\n}",
      "pit": "Storing a Context in a struct field instead of passing it per call makes cancellation unclear and is discouraged by the context docs.",
      "u": "https://go.dev/blog/context"
    },
    {
      "id": "race",
      "tr": "conc",
      "t": "Race detector",
      "pre": ["sync", "testing"],
      "s": "The race detector finds data races at run time: two goroutines touching the same memory without synchronization, where at least one writes.",
      "p": [
        "Enable it with -race on go test, go run, or go build.",
        "It only finds races in code paths that actually run, so good tests matter.",
        "It slows programs noticeably; use it in CI and testing, not normally in production."
      ],
      "c": "$ go test -race ./...\n\n// A race it will report:\ncount := 0\nfor range 10 {\n    go func() { count++ }()\n}",
      "pit": "Treating a clean -race run as proof of no races; it only checks the interleavings that happened during that run.",
      "u": "https://go.dev/doc/articles/race_detector"
    },
    {
      "id": "patterns",
      "tr": "conc",
      "t": "Worker pools",
      "pre": ["context", "sync"],
      "s": "A worker pool runs a fixed number of goroutines that read jobs from one channel and write results to another. It bounds concurrency and keeps resource use predictable.",
      "p": [
        "Close the jobs channel when there is no more work; workers exit when range ends.",
        "Close the results channel only after all workers are done (WaitGroup).",
        "golang.org/x/sync/errgroup adds error propagation and cancellation to this pattern."
      ],
      "c": "jobs := make(chan string)\nresults := make(chan int)\nvar wg sync.WaitGroup\nfor range 4 {\n    wg.Go(func() {\n        for j := range jobs {\n            results <- len(j)\n        }\n    })\n}\ngo func() { wg.Wait(); close(results) }()",
      "pit": "Closing the results channel from a worker while others still send causes a panic; close it once, after wg.Wait.",
      "u": "https://go.dev/blog/pipelines"
    },
    {
      "id": "testing",
      "tr": "tools",
      "t": "Testing & table tests",
      "pre": ["packages", "errors"],
      "s": "Tests live in _test.go files next to the code and use the testing package. Table-driven tests list cases as data and run each one as a subtest.",
      "p": [
        "Test functions look like func TestXxx(t *testing.T).",
        "t.Run gives each case a name, so go test -run can target one.",
        "Use t.Errorf to keep going and t.Fatalf to stop the current test."
      ],
      "c": "func TestClamp(t *testing.T) {\n    tests := []struct {\n        name     string\n        in, want int\n    }{\n        {\"below\", -5, 0},\n        {\"inside\", 5, 5},\n        {\"above\", 50, 10},\n    }\n    for _, tt := range tests {\n        t.Run(tt.name, func(t *testing.T) {\n            if got := Clamp(tt.in, 0, 10); got != tt.want {\n                t.Errorf(\"Clamp(%d) = %d, want %d\", tt.in, got, tt.want)\n            }\n        })\n    }\n}",
      "pit": "Failure messages without the input and the expected value force teammates to rerun the test to understand what broke.",
      "u": "https://go.dev/doc/tutorial/add-a-test"
    },
    {
      "id": "bench",
      "tr": "tools",
      "t": "Benchmarks",
      "pre": ["testing"],
      "s": "Benchmarks measure how long code takes and how much it allocates. They live in test files as func BenchmarkXxx(b *testing.B).",
      "p": [
        "Run them with go test -bench=. -benchmem.",
        "b.Loop (Go 1.24+) is the preferred loop; it keeps setup out of the timing.",
        "Compare runs with benchstat from golang.org/x/perf instead of eyeballing numbers."
      ],
      "c": "func BenchmarkJoin(b *testing.B) {\n    parts := []string{\"a\", \"b\", \"c\"}\n    for b.Loop() {\n        strings.Join(parts, \",\")\n    }\n}\n\n// $ go test -bench=Join -benchmem",
      "pit": "Judging a change from a single benchmark run; noise is often larger than the difference, so use -count and benchstat.",
      "u": "https://pkg.go.dev/testing#hdr-Benchmarks"
    },
    {
      "id": "fuzz",
      "tr": "tools",
      "t": "Fuzzing",
      "pre": ["testing"],
      "s": "Fuzz tests (Go 1.18+) generate inputs automatically to find crashes and broken invariants. Failing inputs are saved under testdata/fuzz so they become regular test cases.",
      "p": [
        "A fuzz test is func FuzzXxx(f *testing.F) with seed inputs added by f.Add.",
        "go test runs only the seeds; go test -fuzz=FuzzXxx keeps generating inputs.",
        "Check properties such as round-trips rather than exact outputs."
      ],
      "c": "func FuzzReverse(f *testing.F) {\n    f.Add(\"hello\")\n    f.Fuzz(func(t *testing.T, s string) {\n        if !utf8.ValidString(s) {\n            t.Skip()\n        }\n        if Reverse(Reverse(s)) != s {\n            t.Errorf(\"round trip failed for %q\", s)\n        }\n    })\n}",
      "pit": "Not committing the testdata/fuzz files means a crash found once is not rechecked in CI.",
      "u": "https://go.dev/doc/security/fuzz/"
    },
    {
      "id": "pprof",
      "tr": "tools",
      "t": "Profiling with pprof",
      "pre": ["bench", "http-server"],
      "s": "pprof shows where a program spends CPU time and memory. You can collect profiles from benchmarks or from a running service through net/http/pprof.",
      "p": [
        "go test -bench=. -cpuprofile cpu.out, then go tool pprof cpu.out.",
        "Importing net/http/pprof registers /debug/pprof/ handlers on the default mux.",
        "Look at heap, goroutine, and mutex profiles as well as CPU."
      ],
      "c": "import _ \"net/http/pprof\"\n\n// on a separate, internal-only port\ngo func() {\n    log.Println(http.ListenAndServe(\"localhost:6060\", nil))\n}()\n\n// $ go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30",
      "pit": "Exposing /debug/pprof on the public port leaks internals and lets anyone trigger expensive profiles.",
      "u": "https://go.dev/doc/diagnostics"
    },
    {
      "id": "deploy",
      "tr": "tools",
      "t": "Build & deploy",
      "pre": ["modules", "http-server"],
      "s": "go build produces a single binary. With CGO disabled it is usually fully static, and GOOS and GOARCH cross-compile for other platforms from any machine.",
      "p": [
        "CGO_ENABLED=0 avoids a libc dependency, so the binary runs in scratch or distroless images.",
        "-ldflags=\"-s -w\" strips debug info; -trimpath removes local file paths.",
        "go version -m binary shows the module versions that were built in."
      ],
      "c": "$ CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \\\n    go build -trimpath -ldflags=\"-s -w\" -o bin/api ./cmd/api\n\n# Dockerfile (multi-stage)\nFROM golang:1.25 AS build\nWORKDIR /src\nCOPY . .\nRUN CGO_ENABLED=0 go build -o /api ./cmd/api\nFROM gcr.io/distroless/static\nCOPY --from=build /api /api\nENTRYPOINT [\"/api\"]",
      "pit": "Building with cgo on and copying the binary into a scratch image fails at startup because the C library it links to is missing.",
      "u": "https://pkg.go.dev/cmd/go#hdr-Compile_packages_and_dependencies"
    },
    {
      "id": "http-server",
      "tr": "svc",
      "t": "net/http server",
      "pre": ["interfaces", "goroutines"],
      "s": "net/http ships a production-grade HTTP server. A handler is anything with ServeHTTP(w, r), and each request runs in its own goroutine.",
      "p": [
        "http.HandlerFunc turns an ordinary function into a Handler.",
        "Set timeouts on http.Server; the package-level ListenAndServe has none.",
        "Handlers run concurrently, so shared state needs synchronization."
      ],
      "c": "mux := http.NewServeMux()\nmux.HandleFunc(\"/health\", func(w http.ResponseWriter, r *http.Request) {\n    w.Write([]byte(\"ok\"))\n})\n\nsrv := &http.Server{\n    Addr:              \":8080\",\n    Handler:           mux,\n    ReadHeaderTimeout: 5 * time.Second,\n}\nlog.Fatal(srv.ListenAndServe())",
      "pit": "Using http.ListenAndServe with no timeouts lets slow clients hold connections open indefinitely.",
      "u": "https://pkg.go.dev/net/http"
    },
    {
      "id": "routing",
      "tr": "svc",
      "t": "ServeMux patterns",
      "pre": ["http-server"],
      "s": "Since Go 1.22, ServeMux patterns can include an HTTP method and path wildcards. Many services no longer need a third-party router.",
      "p": [
        "\"GET /orders/{id}\" matches the method and captures id; read it with r.PathValue(\"id\").",
        "A trailing {path...} wildcard matches the rest of the path.",
        "When two patterns match, the more specific one wins; conflicting patterns panic at registration."
      ],
      "c": "mux := http.NewServeMux()\nmux.HandleFunc(\"GET /orders/{id}\", getOrder)\nmux.HandleFunc(\"POST /orders\", createOrder)\n\nfunc getOrder(w http.ResponseWriter, r *http.Request) {\n    id := r.PathValue(\"id\")\n    fmt.Fprintf(w, \"order %s\", id)\n}",
      "pit": "A pattern ending in / such as \"/files/\" matches every path below it, which can swallow requests meant for a 404.",
      "u": "https://go.dev/blog/routing-enhancements"
    },
    {
      "id": "json",
      "tr": "svc",
      "t": "JSON encoding",
      "pre": ["structs", "errors"],
      "s": "encoding/json maps exported struct fields to JSON using struct tags. Encoder and Decoder stream to and from an io.Writer or io.Reader, such as an HTTP body.",
      "p": [
        "Only exported fields are encoded; tags set names and omitempty or omitzero (Go 1.24+).",
        "DisallowUnknownFields on a Decoder rejects unexpected input fields.",
        "Decoding into interface{} gives float64 for numbers; prefer concrete structs."
      ],
      "c": "type Order struct {\n    ID    string   `json:\"id\"`\n    Items []string `json:\"items,omitempty\"`\n}\n\nvar in Order\ndec := json.NewDecoder(r.Body)\ndec.DisallowUnknownFields()\nif err := dec.Decode(&in); err != nil {\n    http.Error(w, \"bad json\", http.StatusBadRequest)\n    return\n}\nw.Header().Set(\"Content-Type\", \"application/json\")\njson.NewEncoder(w).Encode(in)",
      "pit": "Lowercase struct fields are silently skipped by encoding/json, so the response is missing data with no error.",
      "u": "https://go.dev/blog/json"
    },
    {
      "id": "middleware",
      "tr": "svc",
      "t": "Middleware",
      "pre": ["routing", "context"],
      "s": "Middleware is a function that takes an http.Handler and returns a new one that wraps it. It is the standard way to add logging, auth, recovery, and timeouts.",
      "p": [
        "Signature: func(next http.Handler) http.Handler.",
        "Pass request-scoped values with r.WithContext(context.WithValue(...)).",
        "Order matters: the outermost middleware runs first on the way in."
      ],
      "c": "func requireKey(next http.Handler) http.Handler {\n    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\n        if r.Header.Get(\"X-API-Key\") == \"\" {\n            http.Error(w, \"unauthorized\", http.StatusUnauthorized)\n            return\n        }\n        next.ServeHTTP(w, r)\n    })\n}\n\nsrv.Handler = requireKey(mux)",
      "pit": "Forgetting to return after writing an error response lets the request fall through to next and write a second response.",
      "u": "https://pkg.go.dev/net/http#Handler"
    },
    {
      "id": "database",
      "tr": "svc",
      "t": "database/sql",
      "pre": ["context", "structs"],
      "s": "database/sql is a driver-agnostic API over a connection pool. sql.Open returns a long-lived *sql.DB that you share across the whole service.",
      "p": [
        "Use the Context variants: QueryContext, ExecContext, QueryRowContext.",
        "Always use placeholders for parameters; never build SQL with string concatenation.",
        "Tune the pool with SetMaxOpenConns, SetMaxIdleConns, and SetConnMaxLifetime."
      ],
      "c": "rows, err := db.QueryContext(ctx,\n    \"SELECT id, total FROM orders WHERE customer_id = $1\", custID)\nif err != nil {\n    return err\n}\ndefer rows.Close()\nfor rows.Next() {\n    var o Order\n    if err := rows.Scan(&o.ID, &o.Total); err != nil {\n        return err\n    }\n}\nreturn rows.Err()",
      "pit": "Forgetting rows.Close keeps the connection checked out, and the pool slowly runs dry under load.",
      "u": "https://go.dev/doc/database/"
    },
    {
      "id": "slog",
      "tr": "svc",
      "t": "Logging with slog",
      "pre": ["context", "packages"],
      "s": "log/slog (Go 1.21+) is the standard structured logger. Each record has a level, a message, and key-value attributes, written as text or JSON by a handler.",
      "p": [
        "slog.New(slog.NewJSONHandler(os.Stdout, nil)) gives machine-readable logs.",
        "logger.With(\"request_id\", id) creates a child logger that adds attributes to every record.",
        "The Context variants such as InfoContext let custom handlers read trace data from ctx."
      ],
      "c": "logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{\n    Level: slog.LevelInfo,\n}))\nslog.SetDefault(logger)\n\nreqLog := logger.With(\"request_id\", reqID)\nreqLog.Info(\"order created\", \"order_id\", o.ID, \"items\", len(o.Items))\nreqLog.Error(\"payment failed\", \"err\", err)",
      "pit": "Passing an odd number of key-value arguments produces a !BADKEY attribute; go vet catches many of these.",
      "u": "https://go.dev/blog/slog"
    },
    {
      "id": "shutdown",
      "tr": "svc",
      "t": "Graceful shutdown",
      "pre": ["middleware", "patterns", "slog"],
      "s": "A graceful shutdown stops accepting new connections, lets in-flight requests finish, then exits. http.Server.Shutdown does this when given a context with a deadline.",
      "p": [
        "signal.NotifyContext turns SIGINT or SIGTERM into a cancelled context.",
        "After Shutdown is called, ListenAndServe returns http.ErrServerClosed; that is not a failure.",
        "Stop background workers and close the database after the server has drained."
      ],
      "c": "ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)\ndefer stop()\n\ngo func() {\n    if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {\n        slog.Error(\"server\", \"err\", err)\n    }\n}()\n\n<-ctx.Done()\nshutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)\ndefer cancel()\nsrv.Shutdown(shutCtx)",
      "pit": "Exiting main right after calling Shutdown without waiting for it to return cuts off the requests it was meant to drain.",
      "u": "https://pkg.go.dev/net/http#Server.Shutdown"
    }
  ]
}
