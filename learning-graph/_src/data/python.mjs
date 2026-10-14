// id, tr (track key), t (title, <=22 chars), pre (prerequisite ids), s (summary), p (key points), c (code), pit (common mistake), u (docs URL)
export default {
  out: "python_learning_graph",
  title: "Python Learning Graph",
  sub: "Targets Python 3.13 and later (CPython).",
  foot: "Links go to official sources: docs.python.org, the PEPs, and each library's own documentation. Check which Python versions still get fixes on the <a href=\"https://devguide.python.org/versions/\">Python version status page</a>.",
  key: "python-learning-graph-v1",
  tracks: [
    { k: "basics", n: "Basics" },
    { k: "data", n: "Data structures" },
    { k: "oop", n: "Functions & OOP" },
    { k: "adv", n: "Pythonic & advanced" },
    { k: "conc", n: "Concurrency" },
    { k: "web", n: "Tooling & web" }
  ],
  nodes: [
    // ---------- Basics ----------
    {
      id: "objects",
      tr: "basics",
      t: "Names & objects",
      pre: [],
      s: "Every value in Python is an object with an identity, a type, and a value. Variables are names bound to objects; assignment never copies data, it only binds another name.",
      p: [
        "a = b makes both names point to the same object.",
        "Mutable objects (list, dict, set) can change in place; immutable ones (int, str, tuple) cannot.",
        "is compares identity; == compares value. Use is only for None, True, False."
      ],
      c: "a = [1, 2]\nb = a            # same list, two names\nb.append(3)\nprint(a)         # [1, 2, 3]\nprint(a is b)    # True\n\nc = list(a)      # a real copy\nprint(c == a, c is a)  # True False",
      pit: "Assuming b = a copies a list or dict, then being surprised when changing b also changes a.",
      u: "https://docs.python.org/3/reference/datamodel.html#objects-values-and-types"
    },
    {
      id: "types",
      tr: "basics",
      t: "Built-in types",
      pre: ["objects"],
      s: "Python ships with int, float, bool, str, bytes, None, and the container types. Typing is dynamic but strong: a name can be rebound to anything, but types do not silently convert.",
      p: [
        "int has arbitrary precision; float is a 64-bit IEEE double.",
        "Truthiness: 0, '', None, and empty containers are falsy.",
        "Mixing types like '1' + 1 raises TypeError instead of guessing."
      ],
      c: "n = 2 ** 100           # no overflow\nprint(0.1 + 0.2)       # 0.30000000000000004\nprint(int('42') + 1)   # explicit conversion\n\nitems = []\nif not items:\n    print('empty')",
      pit: "Comparing floats with == (0.1 + 0.2 == 0.3 is False). Use math.isclose or decimal.Decimal for money.",
      u: "https://docs.python.org/3/library/stdtypes.html"
    },
    {
      id: "control",
      tr: "basics",
      t: "Control flow",
      pre: ["types"],
      s: "if/elif/else, for, while, and match shape program logic. for loops iterate over any iterable, not over index ranges.",
      p: [
        "Use enumerate() when you need the index and zip() to walk two sequences together.",
        "match (3.10+) does structural pattern matching, not just switch on a value.",
        "A loop's else block runs only when the loop did not hit break."
      ],
      c: "for i, name in enumerate(['ana', 'bo']):\n    print(i, name)\n\ndef describe(cmd):\n    match cmd.split():\n        case ['go', direction]:\n            return f'moving {direction}'\n        case ['quit']:\n            return 'bye'\n        case _:\n            return 'unknown'",
      pit: "Writing for i in range(len(items)) and indexing, instead of iterating items directly or using enumerate.",
      u: "https://docs.python.org/3/tutorial/controlflow.html"
    },
    {
      id: "functions",
      tr: "basics",
      t: "Functions",
      pre: ["control"],
      s: "def creates a function object and binds it to a name. Functions are first-class: you can pass them, return them, and store them in containers.",
      p: [
        "Arguments can be positional or keyword; keyword calls read better at call sites.",
        "Default values are evaluated once, when def runs, not on every call.",
        "A function with no return statement returns None."
      ],
      c: "def add_tag(tag, tags=None):\n    if tags is None:       # fresh list per call\n        tags = []\n    tags.append(tag)\n    return tags\n\nprint(add_tag('a'))  # ['a']\nprint(add_tag('b'))  # ['b']",
      pit: "Using a mutable default like def f(tags=[]): the same list is shared across every call.",
      u: "https://docs.python.org/3/tutorial/controlflow.html#defining-functions"
    },
    {
      id: "scope",
      tr: "basics",
      t: "Scope & LEGB",
      pre: ["functions"],
      s: "Names are looked up Local, Enclosing, Global, then Built-in (LEGB). Assigning to a name anywhere in a function makes it local to that whole function.",
      p: [
        "global rebinds a module-level name; nonlocal rebinds a name in an enclosing function.",
        "Reading an outer name needs no keyword; rebinding it does.",
        "Shadowing built-ins (list, id, type) breaks later code in the same scope."
      ],
      c: "count = 0\n\ndef bump():\n    global count\n    count += 1\n\ndef broken():\n    print(count)   # UnboundLocalError\n    count = 5      # makes count local everywhere in broken()",
      pit: "Getting UnboundLocalError because a later assignment in the function made the name local.",
      u: "https://docs.python.org/3/reference/executionmodel.html#naming-and-binding"
    },
    {
      id: "exceptions",
      tr: "basics",
      t: "Exceptions",
      pre: ["functions"],
      s: "Errors are signalled by raising exceptions and handled with try/except/else/finally. Python style is to try the operation and handle failure (EAFP).",
      p: [
        "Catch the most specific exception you can handle; let the rest propagate.",
        "raise NewError(...) from err keeps the original cause in the traceback.",
        "ExceptionGroup and except* (3.11+) handle several errors raised together."
      ],
      c: "class ConfigError(Exception):\n    pass\n\ndef load_port(raw):\n    try:\n        return int(raw)\n    except ValueError as err:\n        raise ConfigError(f'bad port: {raw!r}') from err\n    finally:\n        print('checked')",
      pit: "A bare except: or except Exception: pass that swallows bugs, including typos, silently.",
      u: "https://docs.python.org/3/tutorial/errors.html"
    },
    {
      id: "modules",
      tr: "basics",
      t: "Modules & imports",
      pre: ["functions"],
      s: "Each .py file is a module; a directory of modules is a package. import runs a module once and caches it in sys.modules.",
      p: [
        "Prefer absolute imports (from app.db import session) over deep relative ones.",
        "Code under if __name__ == '__main__': runs only when the file is executed directly.",
        "python -m package.module runs a module with the package on the import path."
      ],
      c: "# app/utils.py\ndef slugify(text):\n    return text.lower().replace(' ', '-')\n\nif __name__ == '__main__':\n    print(slugify('Hello World'))\n\n# app/main.py\nfrom app.utils import slugify",
      pit: "Naming your own file json.py or random.py, which shadows the standard library module.",
      u: "https://docs.python.org/3/tutorial/modules.html"
    },

    // ---------- Data structures ----------
    {
      id: "lists-tuples",
      tr: "data",
      t: "Lists & tuples",
      pre: ["types", "control"],
      s: "A list is a mutable ordered sequence; a tuple is an immutable one. Both support indexing, slicing, and unpacking.",
      p: [
        "Slicing (items[1:3]) returns a new list; negative indexes count from the end.",
        "Tuples are good for fixed records and as dict keys (if their items are hashable).",
        "Unpacking: first, *rest = items."
      ],
      c: "items = [3, 1, 2]\nitems.sort()                 # in place, returns None\nsorted_copy = sorted(items)  # new list\n\npoint = (10, 20)\nx, y = point\nfirst, *rest = [1, 2, 3]\nprint(rest)                  # [2, 3]",
      pit: "Writing items = items.sort(), which sets items to None because sort() works in place.",
      u: "https://docs.python.org/3/tutorial/datastructures.html"
    },
    {
      id: "dicts-sets",
      tr: "data",
      t: "Dicts & sets",
      pre: ["lists-tuples"],
      s: "A dict maps hashable keys to values with average O(1) lookup and keeps insertion order. A set stores unique hashable items and supports union and intersection.",
      p: [
        "Use d.get(key, default) or 'key in d' instead of catching KeyError for normal lookups.",
        "collections.defaultdict and Counter remove boilerplate for grouping and counting.",
        "Keys must be hashable: str, int, tuple of hashables. Lists cannot be keys."
      ],
      c: "from collections import Counter, defaultdict\n\nwords = ['a', 'b', 'a']\nprint(Counter(words))        # Counter({'a': 2, 'b': 1})\n\nby_len = defaultdict(list)\nfor w in ['hi', 'yo', 'hey']:\n    by_len[len(w)].append(w)\n\nprint({1, 2} & {2, 3})       # {2}",
      pit: "Changing a dict's keys while iterating over it raises RuntimeError; iterate over list(d) instead.",
      u: "https://docs.python.org/3/library/stdtypes.html#mapping-types-dict"
    },
    {
      id: "strings",
      tr: "data",
      t: "Strings & bytes",
      pre: ["types"],
      s: "str is immutable Unicode text; bytes is raw binary data. Convert between them at the edges of your program with encode() and decode().",
      p: [
        "f-strings are the normal way to format: f'{name}: {value:.2f}'.",
        "Build big strings with ''.join(parts), not += in a loop.",
        "Always name the encoding when reading or writing text: encoding='utf-8'."
      ],
      c: "name, total = 'Ana', 3.14159\nprint(f'{name}: {total:.2f}')   # Ana: 3.14\n\ndata = 'café'.encode('utf-8')   # b'caf\\xc3\\xa9'\ntext = data.decode('utf-8')\n\nline = ', '.join(['a', 'b', 'c'])",
      pit: "Mixing str and bytes, or relying on the platform default encoding, which differs between machines.",
      u: "https://docs.python.org/3/howto/unicode.html"
    },
    {
      id: "comprehensions",
      tr: "data",
      t: "Comprehensions",
      pre: ["dicts-sets", "functions"],
      s: "List, dict, and set comprehensions build a collection from an iterable in one expression. They are clearer and usually faster than an append loop.",
      p: [
        "Shape: [expr for item in iterable if condition].",
        "Use a generator expression (parentheses) when you only iterate once, e.g. sum(x for x in xs).",
        "If it needs more than one if or two for clauses, a normal loop is easier to read."
      ],
      c: "users = [{'name': 'ana', 'active': True}, {'name': 'bo', 'active': False}]\n\nactive = [u['name'] for u in users if u['active']]\nby_name = {u['name']: u for u in users}\ninitials = {u['name'][0] for u in users}\ntotal = sum(len(u['name']) for u in users)",
      pit: "Using a comprehension only for side effects, like [print(x) for x in xs]; use a for loop.",
      u: "https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions"
    },
    {
      id: "iterators",
      tr: "data",
      t: "Iterators",
      pre: ["comprehensions"],
      s: "An iterable can produce an iterator with iter(); an iterator yields values with next() until it raises StopIteration. for loops use this protocol under the hood.",
      p: [
        "Lists are iterables you can loop over many times; iterators are consumed once.",
        "map, filter, zip, and file objects return lazy iterators.",
        "Implement __iter__ and __next__ to make your own iterator."
      ],
      c: "nums = [1, 2, 3]\nit = iter(nums)\nprint(next(it))      # 1\n\nsquares = map(lambda n: n * n, nums)\nprint(list(squares)) # [1, 4, 9]\nprint(list(squares)) # [] - already consumed",
      pit: "Looping over the same map/zip/generator twice and getting nothing the second time.",
      u: "https://docs.python.org/3/library/stdtypes.html#iterator-types"
    },
    {
      id: "generators",
      tr: "data",
      t: "Generators",
      pre: ["iterators"],
      s: "A function with yield returns a generator: a lazy iterator that pauses between values. It lets you stream large data without holding it all in memory.",
      p: [
        "Each yield hands one value to the caller and pauses until the next request.",
        "yield from delegates to another iterable or generator.",
        "Generator pipelines process one item at a time end to end."
      ],
      c: "def read_rows(path):\n    with open(path, encoding='utf-8') as f:\n        for line in f:\n            yield line.rstrip('\\n').split(',')\n\ndef only_paid(rows):\n    return (r for r in rows if r[2] == 'paid')\n\nfor row in only_paid(read_rows('orders.csv')):\n    print(row[0])",
      pit: "Calling len() or indexing on a generator, or expecting the body to run before you start iterating.",
      u: "https://docs.python.org/3/howto/functional.html#generators"
    },
    {
      id: "files-pathlib",
      tr: "data",
      t: "Files & pathlib",
      pre: ["strings", "context-managers"],
      s: "pathlib.Path represents file system paths as objects and works the same on Windows and Unix. Open files with a with block so they are always closed.",
      p: [
        "Join paths with the / operator: Path('data') / 'in.csv'.",
        "Path.read_text() and write_text() cover small files in one call.",
        "Iterate a file object line by line for large files instead of read()."
      ],
      c: "from pathlib import Path\n\nbase = Path(__file__).parent\nreport = base / 'out' / 'report.txt'\nreport.parent.mkdir(parents=True, exist_ok=True)\nreport.write_text('done\\n', encoding='utf-8')\n\nfor csv in base.glob('*.csv'):\n    print(csv.name, csv.stat().st_size)",
      pit: "Building paths with string concatenation and hard-coded '\\\\' or '/', which breaks across operating systems.",
      u: "https://docs.python.org/3/library/pathlib.html"
    },

    // ---------- Functions & OOP ----------
    {
      id: "args-kwargs",
      tr: "oop",
      t: "*args & **kwargs",
      pre: ["functions", "dicts-sets"],
      s: "*args collects extra positional arguments into a tuple; **kwargs collects extra keyword arguments into a dict. The same symbols unpack sequences and dicts at a call site.",
      p: [
        "Parameters after * are keyword-only; parameters before / are positional-only.",
        "Forwarding with f(*args, **kwargs) is the basis of wrappers and decorators.",
        "Keyword-only flags make call sites readable: send(msg, retry=True)."
      ],
      c: "def log(level, *parts, sep=' ', **extra):\n    print(level, sep.join(map(str, parts)), extra)\n\nlog('INFO', 'user', 42, sep='/', ip='10.0.0.1')\n# INFO user/42 {'ip': '10.0.0.1'}\n\nopts = {'sep': '-'}\nlog('DEBUG', *['a', 'b'], **opts)",
      pit: "Accepting **kwargs everywhere and silently ignoring misspelled keyword arguments.",
      u: "https://docs.python.org/3/tutorial/controlflow.html#arbitrary-argument-lists"
    },
    {
      id: "closures",
      tr: "oop",
      t: "Closures",
      pre: ["scope"],
      s: "A nested function that uses names from its enclosing function keeps access to them after the outer function returns. That captured environment is a closure.",
      p: [
        "Closures capture variables, not values; the value is read when the inner function runs.",
        "Use nonlocal to rebind a captured variable.",
        "Closures are a light alternative to a small class with one method."
      ],
      c: "def counter():\n    n = 0\n    def step():\n        nonlocal n\n        n += 1\n        return n\n    return step\n\nnext_id = counter()\nprint(next_id(), next_id())  # 1 2",
      pit: "Creating lambdas in a loop that all see the last loop value; bind it with a default, lambda i=i: i.",
      u: "https://docs.python.org/3/faq/programming.html#why-do-lambdas-defined-in-a-loop-with-different-values-all-return-the-same-result"
    },
    {
      id: "classes",
      tr: "oop",
      t: "Classes",
      pre: ["functions", "dicts-sets"],
      s: "A class bundles data (attributes) and behaviour (methods). Instances get their own attributes, usually set in __init__; self is the instance passed explicitly.",
      p: [
        "Class attributes are shared by all instances; instance attributes belong to one object.",
        "@property exposes a computed value with attribute syntax.",
        "@classmethod is common for alternate constructors; @staticmethod for plain helpers."
      ],
      c: "class Account:\n    fee = 0.5                   # class attribute\n\n    def __init__(self, owner, balance=0):\n        self.owner = owner\n        self.balance = balance\n\n    @property\n    def can_withdraw(self):\n        return self.balance > self.fee\n\n    @classmethod\n    def empty(cls, owner):\n        return cls(owner)",
      pit: "Putting a mutable value like items = [] on the class, so every instance shares one list.",
      u: "https://docs.python.org/3/tutorial/classes.html"
    },
    {
      id: "dunder",
      tr: "oop",
      t: "Dunder methods",
      pre: ["classes"],
      s: "Special 'double underscore' methods let your objects plug into built-in syntax: printing, comparison, len(), iteration, arithmetic, and with blocks.",
      p: [
        "__repr__ is for developers and should be unambiguous; __str__ is for display.",
        "Defining __eq__ without __hash__ makes instances unhashable.",
        "Return NotImplemented (not False) when an operation does not support the other type."
      ],
      c: "class Money:\n    def __init__(self, cents):\n        self.cents = cents\n\n    def __repr__(self):\n        return f'Money({self.cents})'\n\n    def __add__(self, other):\n        if not isinstance(other, Money):\n            return NotImplemented\n        return Money(self.cents + other.cents)\n\nprint(Money(5) + Money(7))  # Money(12)",
      pit: "Calling dunders directly (obj.__len__()) instead of the built-in (len(obj)).",
      u: "https://docs.python.org/3/reference/datamodel.html#special-method-names"
    },
    {
      id: "inheritance",
      tr: "oop",
      t: "Inheritance & MRO",
      pre: ["classes"],
      s: "A subclass reuses and overrides a base class. With multiple inheritance, Python follows the method resolution order (MRO), which super() also uses.",
      p: [
        "super() calls the next class in the MRO, not necessarily the direct parent.",
        "Inspect the order with ClassName.__mro__ or ClassName.mro().",
        "Prefer composition or small mixins over deep inheritance trees."
      ],
      c: "class Base:\n    def save(self):\n        print('Base.save')\n\nclass AuditMixin(Base):\n    def save(self):\n        print('audit')\n        super().save()\n\nclass User(AuditMixin, Base):\n    pass\n\nUser().save()              # audit, Base.save\nprint([c.__name__ for c in User.__mro__])",
      pit: "Calling Base.method(self) directly in a mixin chain, which skips other classes in the MRO.",
      u: "https://docs.python.org/3/howto/mro.html"
    },
    {
      id: "dataclasses",
      tr: "oop",
      t: "Dataclasses",
      pre: ["dunder", "type-hints"],
      s: "@dataclass generates __init__, __repr__, and __eq__ from annotated fields. It is the standard way to write plain data-holding classes.",
      p: [
        "frozen=True makes instances immutable and hashable.",
        "slots=True (3.10+) saves memory and blocks typo attributes.",
        "Use field(default_factory=list) for mutable defaults."
      ],
      c: "from dataclasses import dataclass, field\n\n@dataclass(frozen=True, slots=True)\nclass Order:\n    id: int\n    customer: str\n    tags: tuple[str, ...] = ()\n\n@dataclass\nclass Cart:\n    items: list[str] = field(default_factory=list)\n\nprint(Order(1, 'ana'))  # Order(id=1, customer='ana', tags=())",
      pit: "Expecting dataclass type annotations to be checked at runtime; they are not validated.",
      u: "https://docs.python.org/3/library/dataclasses.html"
    },
    {
      id: "protocols",
      tr: "oop",
      t: "Protocols & ABCs",
      pre: ["inheritance", "type-hints"],
      s: "An abstract base class (abc.ABC) forces subclasses to implement methods. A typing.Protocol describes a required shape that any class matches structurally, without inheriting.",
      p: [
        "ABCs fail at instantiation if abstract methods are missing.",
        "Protocols are checked by type checkers; add @runtime_checkable for isinstance checks.",
        "Protocols suit duck typing: accept anything with a .read() method."
      ],
      c: "from abc import ABC, abstractmethod\nfrom typing import Protocol\n\nclass Storage(ABC):\n    @abstractmethod\n    def put(self, key: str, data: bytes) -> None: ...\n\nclass Readable(Protocol):\n    def read(self) -> str: ...\n\ndef first_line(src: Readable) -> str:\n    return src.read().splitlines()[0]",
      pit: "Relying on isinstance with a runtime_checkable Protocol to verify signatures; it only checks that the attributes exist.",
      u: "https://docs.python.org/3/library/typing.html#typing.Protocol"
    },

    // ---------- Pythonic & advanced ----------
    {
      id: "type-hints",
      tr: "adv",
      t: "Type hints",
      pre: ["classes"],
      s: "Annotations describe expected types. Python does not enforce them at runtime; static checkers like mypy or pyright read them and report mistakes before the code runs.",
      p: [
        "Use built-in generics: list[int], dict[str, User], and X | None.",
        "Run the checker in CI so hints stay honest.",
        "Annotate public functions first; local variables are usually inferred."
      ],
      c: "from collections.abc import Iterable\n\ndef total(prices: Iterable[float], discount: float | None = None) -> float:\n    s = sum(prices)\n    return s * (1 - discount) if discount else s\n\ntotal([9.99, 5.0])\ntotal('abc')   # flagged by mypy/pyright, runs until it fails",
      pit: "Treating hints as validation; bad data still flows through at runtime unless you check it (for example with pydantic).",
      u: "https://docs.python.org/3/library/typing.html"
    },
    {
      id: "decorators",
      tr: "adv",
      t: "Decorators",
      pre: ["closures", "args-kwargs"],
      s: "A decorator is a callable that takes a function and returns a replacement. @name above a def is shorthand for func = name(func).",
      p: [
        "Wrap with functools.wraps to keep the original name and docstring.",
        "Forward *args and **kwargs so the wrapper fits any signature.",
        "A decorator with arguments is a function that returns a decorator."
      ],
      c: "import functools, time\n\ndef timed(func):\n    @functools.wraps(func)\n    def wrapper(*args, **kwargs):\n        start = time.perf_counter()\n        try:\n            return func(*args, **kwargs)\n        finally:\n            print(f'{func.__name__}: {time.perf_counter() - start:.3f}s')\n    return wrapper\n\n@timed\ndef work():\n    time.sleep(0.1)",
      pit: "Forgetting functools.wraps, so logs, tracebacks, and frameworks see every function as 'wrapper'.",
      u: "https://docs.python.org/3/glossary.html#term-decorator"
    },
    {
      id: "context-managers",
      tr: "adv",
      t: "Context managers",
      pre: ["exceptions", "classes", "generators"],
      s: "A with block runs setup code, then guarantees cleanup even if an exception occurs. Files, locks, DB sessions, and transactions all use it.",
      p: [
        "A class implements __enter__ and __exit__.",
        "contextlib.contextmanager turns a generator with one yield into a context manager.",
        "contextlib.ExitStack manages a variable number of resources."
      ],
      c: "from contextlib import contextmanager\nimport time\n\n@contextmanager\ndef timer(label):\n    start = time.perf_counter()\n    try:\n        yield\n    finally:\n        print(label, time.perf_counter() - start)\n\nwith timer('load'):\n    data = list(range(1_000_000))",
      pit: "Leaving out try/finally around the yield, so cleanup is skipped when the block raises.",
      u: "https://docs.python.org/3/library/contextlib.html"
    },
    {
      id: "itertools",
      tr: "adv",
      t: "itertools & functools",
      pre: ["generators", "decorators"],
      s: "itertools offers fast, lazy building blocks for iteration; functools offers tools for working with functions such as caching and partial application.",
      p: [
        "itertools.batched (3.12+), chain, groupby, and islice cover most stream work.",
        "functools.cache / lru_cache memoise pure functions.",
        "functools.partial fixes some arguments of a function in advance."
      ],
      c: "from functools import cache, partial\nfrom itertools import chain, islice\n\n@cache\ndef fib(n: int) -> int:\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\n\nprint(fib(80))\nfirst5 = list(islice(chain([1, 2], range(10, 20)), 5))\nto_int = partial(int, base=2)\nprint(to_int('101'))  # 5",
      pit: "Using groupby on unsorted data; it only groups consecutive equal keys.",
      u: "https://docs.python.org/3/library/itertools.html"
    },
    {
      id: "logging",
      tr: "adv",
      t: "Logging",
      pre: ["modules", "exceptions"],
      s: "The logging module gives levels, named loggers, and configurable handlers. Libraries create loggers; the application configures output once at startup.",
      p: [
        "Use logger = logging.getLogger(__name__) in each module.",
        "Configure once at the entry point (logging.basicConfig or dictConfig).",
        "logger.exception(...) inside except logs the traceback too."
      ],
      c: "import logging\n\nlogger = logging.getLogger(__name__)\n\ndef charge(order_id: int) -> None:\n    logger.info('charging order %s', order_id)\n    try:\n        raise TimeoutError('gateway')\n    except TimeoutError:\n        logger.exception('charge failed for %s', order_id)\n\nif __name__ == '__main__':\n    logging.basicConfig(level=logging.INFO)\n    charge(7)",
      pit: "Using print for diagnostics in services, or calling basicConfig inside library code.",
      u: "https://docs.python.org/3/howto/logging.html"
    },
    {
      id: "performance",
      tr: "adv",
      t: "Profiling & speed",
      pre: ["itertools", "pytest"],
      s: "Measure before optimising. timeit times small snippets; cProfile shows where a whole program spends its time. Most wins come from better data structures and algorithms.",
      p: [
        "A set or dict lookup is O(1) on average; 'x in list' is O(n).",
        "Push loops into built-ins (sum, sorted, str.join) that run in C.",
        "Profile with realistic input, then optimise the top hotspot only."
      ],
      c: "# python -m cProfile -s cumtime app.py\n# python -m timeit -s 'xs = list(range(10_000))' '9_999 in xs'\n\nimport cProfile, pstats\n\nwith cProfile.Profile() as prof:\n    sorted(str(i) for i in range(200_000))\n\npstats.Stats(prof).sort_stats('cumulative').print_stats(5)",
      pit: "Micro-optimising code by guessing, without a profile, while the real cost is an O(n^2) loop or a slow query.",
      u: "https://docs.python.org/3/library/profile.html"
    },

    // ---------- Concurrency ----------
    {
      id: "threads-gil",
      tr: "conc",
      t: "Threads & the GIL",
      pre: ["context-managers"],
      s: "In the standard CPython build, the Global Interpreter Lock lets only one thread run Python bytecode at a time. Threads still help with I/O-bound work because the lock is released while waiting.",
      p: [
        "I/O-bound (network, disk): threads or asyncio. CPU-bound: processes.",
        "Shared mutable state still needs a threading.Lock; the GIL does not make your code thread-safe.",
        "CPython 3.13+ also offers a separate, optional free-threaded build without the GIL; check that your C extensions support it."
      ],
      c: "import threading\n\ncounter = 0\nlock = threading.Lock()\n\ndef work():\n    global counter\n    for _ in range(100_000):\n        with lock:\n            counter += 1\n\nthreads = [threading.Thread(target=work) for _ in range(4)]\nfor t in threads: t.start()\nfor t in threads: t.join()\nprint(counter)  # 400000",
      pit: "Using threads to speed up CPU-heavy pure-Python code on the default build; it usually gets slower, not faster.",
      u: "https://docs.python.org/3/library/threading.html"
    },
    {
      id: "executors",
      tr: "conc",
      t: "Thread & process pools",
      pre: ["threads-gil"],
      s: "concurrent.futures gives one API for thread pools and process pools. Use ThreadPoolExecutor for I/O-bound jobs and ProcessPoolExecutor for CPU-bound jobs.",
      p: [
        "pool.map keeps input order; as_completed yields results as they finish.",
        "Process pools pickle arguments and results, so they must be picklable.",
        "Guard process-pool code with if __name__ == '__main__': on Windows and macOS."
      ],
      c: "from concurrent.futures import ProcessPoolExecutor\n\ndef heavy(n: int) -> int:\n    return sum(i * i for i in range(n))\n\nif __name__ == '__main__':\n    with ProcessPoolExecutor() as pool:\n        results = list(pool.map(heavy, [10**6] * 8))\n    print(len(results))",
      pit: "Passing lambdas or open connections to a process pool; they cannot be pickled.",
      u: "https://docs.python.org/3/library/concurrent.futures.html"
    },
    {
      id: "asyncio",
      tr: "conc",
      t: "async & await",
      pre: ["generators"],
      s: "asyncio runs many I/O-bound tasks on one thread. async def defines a coroutine; await pauses it until a result is ready so the event loop can run other tasks.",
      p: [
        "asyncio.run(main()) starts the event loop at the program entry point.",
        "Calling a coroutine function only creates a coroutine object; it runs when awaited or scheduled.",
        "Blocking calls (time.sleep, requests, heavy CPU) freeze every task on the loop."
      ],
      c: "import asyncio\n\nasync def fetch(name: str, delay: float) -> str:\n    await asyncio.sleep(delay)   # non-blocking wait\n    return name\n\nasync def main():\n    results = await asyncio.gather(fetch('a', 1), fetch('b', 1))\n    print(results)               # ~1s total, not 2s\n\nasyncio.run(main())",
      pit: "Calling time.sleep() or a blocking HTTP client inside async code; use asyncio.sleep, an async client, or asyncio.to_thread.",
      u: "https://docs.python.org/3/library/asyncio-task.html"
    },
    {
      id: "async-tasks",
      tr: "conc",
      t: "Tasks & timeouts",
      pre: ["asyncio", "exceptions"],
      s: "asyncio.TaskGroup (3.11+) runs tasks together and cancels the rest if one fails. asyncio.timeout (3.11+) bounds how long a block may take.",
      p: [
        "If tasks in a TaskGroup fail, errors are raised as an ExceptionGroup.",
        "Keep a reference to tasks made with create_task, or they may be garbage-collected.",
        "Do not swallow asyncio.CancelledError; cancellation must propagate."
      ],
      c: "import asyncio\n\nasync def job(n: int) -> int:\n    await asyncio.sleep(n / 10)\n    return n\n\nasync def main():\n    async with asyncio.timeout(2):\n        async with asyncio.TaskGroup() as tg:\n            tasks = [tg.create_task(job(n)) for n in range(5)]\n    print([t.result() for t in tasks])\n\nasyncio.run(main())",
      pit: "Catching Exception around await and continuing, which can hide cancellation and leave tasks running.",
      u: "https://docs.python.org/3/library/asyncio-task.html#task-groups"
    },

    // ---------- Tooling & web ----------
    {
      id: "venv",
      tr: "web",
      t: "Virtual environments",
      pre: ["modules"],
      s: "A virtual environment is an isolated folder with its own interpreter link and installed packages. Every project gets its own, so dependency versions do not clash.",
      p: [
        "Create with python -m venv .venv (or let uv create it for you).",
        "Never install project packages into the system Python.",
        "Add .venv to .gitignore; commit the dependency list, not the environment."
      ],
      c: "# create and activate\npython -m venv .venv\nsource .venv/bin/activate        # macOS/Linux\n.venv\\Scripts\\activate           # Windows\n\npython -m pip install httpx\npython -c \"import sys; print(sys.prefix)\"",
      pit: "Running pip from a different interpreter than the one that runs the app; use python -m pip to be sure.",
      u: "https://docs.python.org/3/library/venv.html"
    },
    {
      id: "packaging",
      tr: "web",
      t: "pyproject & packaging",
      pre: ["venv"],
      s: "pyproject.toml is the standard project file: name, version, Python requirement, dependencies, and tool settings. Tools like uv or pip read it to install and build.",
      p: [
        "Dependencies go in the [project] table; dev tools in a dependency group or extra.",
        "Commit a lock file (for example uv.lock) so every machine installs the same versions.",
        "uv add, uv sync, and uv run manage the venv and lock file for you."
      ],
      c: "[project]\nname = \"orders-api\"\nversion = \"0.1.0\"\nrequires-python = \">=3.13\"\ndependencies = [\n    \"fastapi>=0.115\",\n    \"sqlalchemy>=2.0\",\n]\n\n[tool.pytest.ini_options]\ntestpaths = [\"tests\"]",
      pit: "Leaving dependencies unpinned with no lock file, so a fresh install months later pulls breaking versions.",
      u: "https://packaging.python.org/en/latest/guides/writing-pyproject-toml/"
    },
    {
      id: "pytest",
      tr: "web",
      t: "Testing with pytest",
      pre: ["packaging", "exceptions"],
      s: "pytest finds test_*.py files and test_ functions and uses plain assert with detailed failure output. Fixtures provide setup; parametrize runs one test over many inputs.",
      p: [
        "Fixtures are injected by parameter name and can clean up after a yield.",
        "pytest.raises checks that code raises the expected exception.",
        "tmp_path and monkeypatch are built-in fixtures for files and patching."
      ],
      c: "import pytest\nfrom app.utils import slugify\n\n@pytest.mark.parametrize('raw, expected', [\n    ('Hello World', 'hello-world'),\n    ('A', 'a'),\n])\ndef test_slugify(raw, expected):\n    assert slugify(raw) == expected\n\ndef test_bad_port():\n    with pytest.raises(ValueError):\n        int('abc')",
      pit: "Tests that depend on each other's order or shared global state, so they pass alone and fail together.",
      u: "https://docs.pytest.org/en/stable/how-to/fixtures.html"
    },
    {
      id: "pydantic",
      tr: "web",
      t: "Pydantic validation",
      pre: ["dataclasses", "packaging"],
      s: "Pydantic models use type hints to validate and convert data at runtime. Use them at trust boundaries: request bodies, config, and external API responses.",
      p: [
        "Invalid input raises ValidationError with a field-by-field report.",
        "model_validate() parses dicts; model_dump() converts back to plain data.",
        "Field(...) adds constraints such as min_length or gt."
      ],
      c: "from pydantic import BaseModel, Field, ValidationError\n\nclass OrderIn(BaseModel):\n    customer: str = Field(min_length=1)\n    quantity: int = Field(gt=0)\n\ntry:\n    OrderIn.model_validate({'customer': 'ana', 'quantity': 0})\nexcept ValidationError as err:\n    print(err.errors()[0]['loc'])   # ('quantity',)",
      pit: "Mixing Pydantic v1 examples (.dict(), .parse_obj()) with v2 code that uses model_dump() and model_validate().",
      u: "https://docs.pydantic.dev/latest/concepts/models/"
    },
    {
      id: "sqlalchemy",
      tr: "web",
      t: "SQL with SQLAlchemy",
      pre: ["context-managers", "type-hints", "packaging"],
      s: "SQLAlchemy 2.0 maps classes to tables and builds SQL with select(). A Session tracks objects and commits them in one transaction.",
      p: [
        "Declare columns with Mapped[...] and mapped_column().",
        "Use the session as a context manager so it always closes.",
        "Bound parameters prevent SQL injection; never format values into SQL strings."
      ],
      c: "from sqlalchemy import create_engine, select\nfrom sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session\n\nclass Base(DeclarativeBase): pass\n\nclass User(Base):\n    __tablename__ = 'users'\n    id: Mapped[int] = mapped_column(primary_key=True)\n    email: Mapped[str]\n\nengine = create_engine('sqlite:///app.db')\nBase.metadata.create_all(engine)\nwith Session(engine) as session:\n    session.add(User(email='a@x.io'))\n    session.commit()\n    users = session.scalars(select(User).where(User.email.like('%x.io'))).all()",
      pit: "Loading related objects in a loop (the N+1 query problem); use selectinload or joinedload.",
      u: "https://docs.sqlalchemy.org/en/20/orm/quickstart.html"
    },
    {
      id: "fastapi",
      tr: "web",
      t: "FastAPI basics",
      pre: ["pydantic", "asyncio", "decorators"],
      s: "FastAPI builds HTTP APIs from type-hinted functions. Path, query, and body parameters are parsed and validated from the signature, and OpenAPI docs are generated at /docs.",
      p: [
        "Route decorators (@app.get, @app.post) register handlers.",
        "Pydantic models as parameters become validated JSON bodies; response_model shapes the output.",
        "Use async def only when the handler awaits async I/O; plain def runs in a thread pool."
      ],
      c: "from fastapi import FastAPI, HTTPException\nfrom pydantic import BaseModel\n\napp = FastAPI()\n\nclass Item(BaseModel):\n    name: str\n    price: float\n\nitems: dict[int, Item] = {}\n\n@app.post('/items/{item_id}', status_code=201)\nasync def create(item_id: int, item: Item) -> Item:\n    if item_id in items:\n        raise HTTPException(status_code=409, detail='exists')\n    items[item_id] = item\n    return item",
      pit: "Calling blocking libraries (sync DB drivers, requests) inside async def handlers, which stalls the whole server.",
      u: "https://fastapi.tiangolo.com/tutorial/first-steps/"
    },
    {
      id: "fastapi-deps",
      tr: "web",
      t: "Dependencies & DB",
      pre: ["fastapi", "sqlalchemy", "pytest"],
      s: "FastAPI's Depends() injects shared resources such as a DB session or the current user. A dependency with yield runs cleanup after the response.",
      p: [
        "One session per request: create it in a dependency, close it after yield.",
        "app.dependency_overrides swaps dependencies in tests.",
        "TestClient calls the app in-process without a running server."
      ],
      c: "from typing import Annotated\nfrom fastapi import Depends, FastAPI\nfrom sqlalchemy.orm import Session\n\napp = FastAPI()\n\ndef get_session():\n    with Session(engine) as session:\n        yield session\n\nSessionDep = Annotated[Session, Depends(get_session)]\n\n@app.get('/users/{user_id}')\ndef read_user(user_id: int, session: SessionDep):\n    return session.get(User, user_id)",
      pit: "Sharing one global Session across requests, which mixes transactions between users.",
      u: "https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/"
    }
  ]
};
