import functools
from dataclasses import dataclass
from lark import Lark, Transformer
from os import listdir
from os.path import isfile, join
import pprint as pp

def read_file(filename):
    with open(filename, "r") as f:
        content = f.read()
    return content

def make_parser():
    grammar = read_file("level_grammar.lark")
    return Lark(grammar, start="top", parser="lalr")

def list_files(directory):
    return [join(directory, f) for f in listdir(directory) if isfile(join(directory, f))]



class Node:
    def emit(self, language):
        raise "unimplemented"

    def __repr__(self):
        return self.emit("glsl")

class UnaryOperation(Node):
    def __init__(self, value):
        self.value = value

class BinaryOperation(Node):
    def __init__(self, left, right, center=None):
        self.left = left
        self.right = right
        self.center = center

    def emit(self, language):
        if self.center is None:
            raise "BinaryOperation with no center must override emit()"
        return f"({self.left.emit(language)} {self.center.emit(language)} {self.right.emit(language)})"


class PrimitiveType(UnaryOperation):
    def emit(self, language):
        return str(self.value)


class Conditional(Node):
    def __init__(self, condition, if_true, if_false):
        self.condition = condition
        self.if_true = if_true
        self.if_false = if_false
    
    def emit(self, language):
        return f"({self.condition.emit(language)} ? {self.if_true.emit(language)} : {self.if_false.emit(language)})"

class ManyOperations(Node):
    def __init__(self, sequence, operator=None):
        '''If operator not given, sequence is of form [value, op, value, op, value].
           Otherwise, sequence is a list of operands.'''
        self.sequence = sequence
        self.operator = operator

    def emit(self, language):
        render_fn = lambda x: x if isinstance(x, str) else x.emit(language)
        intersperse = " " if self.operator is None else f" {self.operator} "
        return f"({intersperse.join(map(render_fn, self.sequence))})"

class PrefixOperation(UnaryOperation):
    def __init__(self, value, operation):
        self.value = value
        self.operation = operation

    def emit(self, language):
        return f"{self.operation}{self.value.emit(language)}"


class Negation(UnaryOperation):
    def emit(self, language):
        return f"-{self.value.emit(language)}"

class LogicalNot(UnaryOperation):
    def emit(self, language):
        return f"!{self.value.emit(language)}"

class Increment(UnaryOperation):
    def emit(self, language):
        return f"{self.value.emit(language)}++"

class Decrement(UnaryOperation):
    def emit(self, language):
        return f"{self.value.emit(language)}--"

class Indexed(BinaryOperation):
    def emit(self, language):
        return f"{self.left.emit(language)}[{self.right.emit(language)}]"

class FunctionCall(BinaryOperation):
    def emit(self, language):
        return f"{self.left.emit(language)}({', '.join(map(lambda a: a.emit(language), self.right))})"

class FieldSelection(BinaryOperation):
    def emit(self, language):
        return f"{self.left.emit(language)}.{self.right.emit(language)}"

class Group(UnaryOperation):
    def emit(self, language):
        return f"({self.value.emit(language)})"

class Identifier(UnaryOperation):
    def emit(self, language):
        return self.value

class LiteralFloat(UnaryOperation):
    def emit(self, language):
        s = str(self.value)
        if "." not in s:
            return s + ".0"
        else:
            return s



class Intermediate(Transformer):

    def void(self, c): return PrimitiveType("void")
    def float(self, c): return PrimitiveType("float")
    def int(self, c): return PrimitiveType("int")
    def vec2(self, c): return PrimitiveType("vec2")
    def vec3(self, c): return PrimitiveType("vec3")
    def vec4(self, c): return PrimitiveType("vec4")
    def mat2(self, c): return PrimitiveType("mat2")
    def mat3(self, c): return PrimitiveType("mat3")
    def mat4(self, c): return PrimitiveType("mat4")
    def sampler2D(self, c): return PrimitiveType("sampler2D")







    def assignment(self, c): return ManyOperations(c)
    def conditional(self, c): return Conditional(c[0], c[1], c[2])
    def or_expression(self, c): return ManyOperations(c, operator="||")
    def and_expression(self, c): return ManyOperations(c, operator="&&")
    def equality(self, c): return ManyOperations(c)
    def relational(self, c): return ManyOperations(c)
    def additive(self, c): return ManyOperations(c)
    def multiplicative(self, c): return ManyOperations(c)
    def unary(self, c): return PrefixOperation(c[1], c[0])

    def increment(self, c): return Increment(c[0])
    def decrement(self, c): return Decrement(c[0])
    def indexed(self, c): return Indexed(c[0], c[1])
    def fcall(self, c): return FunctionCall(c[0], [] if len(c) < 2 else c[1])
    def arguments(self, c): return c
    def field_selection(self, c): return FieldSelection(c[0], c[1])
    def group(self, c): return Group(c[0])
    def identifier(self, c): return Identifier(c[0].value)
    def eq(self, c): return "="
    def times_eq(self, c): return "*="
    def divide_eq(self, c): return "/="
    def modulo_eq(self, c): return "%="
    def plus_eq(self, c): return "+="
    def subtract_eq(self, c): return "-="
    def is_equal(self, c): return "=="
    def is_not_equal(self, c): return "!="
    def below(self, c): return "<"
    def above(self, c): return ">"
    def at_most(self, c): return "<="
    def at_least(self, c): return ">="
    def add(self, c): return "+"
    def subtract(self, c): return "-"
    def times(self, c): return "*"
    def divided(self, c): return "/"
    def percent(self, c): return "%"
    def negative(self, c): return "-"
    def logical_not(self, c): return "!"
    def NUMBER(self, c): return LiteralFloat(c)   # c is not a list here..???
















parser = make_parser()
for level in list_files("./levels"):
    text = read_file(level)
    tree = parser.parse(text)
    print(tree.pretty())
    pp.pp(Intermediate().transform(tree))