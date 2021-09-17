import functools
from dataclasses import dataclass
from lark import Lark, Transformer
from os import listdir
from os.path import isfile, join, basename
import pprint as pp

def margin(level):
    return "  " * level

REWRITE_TYPES = {
    "void": "undefined",
    "float": "number",
    "int": "number",
    "vec2": "THREE.Vector2",
    "vec3": "THREE.Vector3",
    "vec4": "THREE.Vector4",
    "mat3": "THREE.Matrix3",
    "mat4": "THREE.Matrix4",
    "sampler2D": "THREE.Texture"
}

REWRITE_CALLS = {
    "THREE.Vector2": "RT.vector2",
    "THREE.Vector3": "RT.vector3",
    "THREE.Vector4": "RT.vector4",
    "THREE.Matrix3": "RT.matrix3",
    "THREE.Matrix4": "RT.matrix4",
    
    "radians": "RT.radians",
    "degrees": "RT.degrees",
    "sin": "RT.sin",
    "cos": "RT.cos",
    "tan": "RT.tan",
    "acos": "RT.acos",
    "asin": "RT.asin",
    "atan": "RT.atan",
    "sinh": "RT.sinh",
    "cosh": "RT.cosh",
    "tanh": "RT.tanh",
    "pow": "RT.pow",
    "exp": "RT.exp",
    "log": "RT.log",
    "exp2": "RT.exp2",
    "log2": "RT.log2",
    "sqrt": "RT.sqrt",
    "inversesqrt": "RT.inversesqrt",
    "abs": "RT.abs",
    "sign": "RT.sign",
    "floor": "RT.floor",
    "trunc": "RT.trunc",
    "round": "RT.round",
    "roundEven": "RT.roundEven",
    "ceil": "RT.ceil",
    "fract": "RT.fract",
    "mod": "RT.mod",
    "min": "RT.min",
    "max": "RT.max",
    "clamp": "RT.clamp",
    "mix": "RT.mix",
    "step": "RT.step",
    "smoothstep": "RT.smoothstep",
    "isnan": "RT.isnan",
    "isinf": "RT.isinf",
    "length": "RT.length",
    "distance": "RT.distance",
    "dot": "RT.dot",
    "cross": "RT.cross",
    "normalize": "RT.normalize",
    "faceforward": "RT.faceforward",
    "reflect": "RT.reflect",
    "refract": "RT.refract",
    "outerProduct": "RT.outerProduct",
    "transpose": "RT.transpose",
    "determinant": "RT.determinant",
    "inverse": "RT.inverse",
    "texture": "RT.texture"

}


class Node:
    def emit(self, language, indent=0):
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

    def emit(self, language, indent=0):
        if self.center is None:
            raise "BinaryOperation with no center must override emit()"
        return f"{self.left.emit(language)} {self.center.emit(language)} {self.right.emit(language)}"


class Top(Node):
    def __init__(self, children):
        self.level = None
        self.renderer = None
        for c in children:
            if isinstance(c, LevelContainer):
                self.level = c
            if isinstance(c, RendererContainer):
                self.renderer = c

class ShaderContainer(Node):
    def __init__(self, children):
        self.children = children
    
    def emit(self, language, indent=0):
        top = []
        body = []

        for c in self.children:
            #print(type(c))
            if isinstance(c, ExpressionStatement):
                top.append(c.emit(language))
            else:
                body.append(c.emit(language))
        
        return ['\n'.join(top), '\n'.join(body)]

class LevelContainer(ShaderContainer):
    def emit(self, language, indent=0):
        if language == "glsl":
            return super().emit(language, indent)
        
        body = []
        body.append("import * as THREE from \"three\";")
        body.append("import * as RT from \"../shader_runtime\";")
        body.append("")

        for c in self.children:
            body.append(c.emit(language))

        return '\n'.join(body);

class RendererContainer(ShaderContainer):
    pass

class PrimitiveType(UnaryOperation):
    def emit(self, language, indent=0):
        primitive = str(self.value)
        if language == "ts":
            if primitive in REWRITE_TYPES:
                return REWRITE_TYPES[primitive]
        return primitive

class ArrayType(BinaryOperation):
    def emit(self, language, indent=0):
        return f"{self.left.emit(language)}{self.right.emit(language)}"

class FunctionDeclaration(Node):
    def __init__(self, return_type, identifier, parameters, block):
        self.return_type = return_type
        self.identifier = identifier
        self.parameter = parameters
        self.block = block
    
    def emit(self, language, indent=0):
        a = self.return_type.emit(language)
        b = self.identifier.emit(language)
        c = self.parameter.emit(language)
        d = self.block.emit(language)

        if language == "glsl":
            return f"{a} {b}({c}) {d}"
        else:
            return f"function {b}({c}): {a} {d}"
    
class Parameter(BinaryOperation):
    def emit(self, language, indent=0):
        if language == "glsl":
            return f"{self.left.emit(language)} {self.right.emit(language)}"
        else:
            return f"{self.right.emit(language)}: {self.left.emit(language)}"

class VariableDeclaration(Node):
    def __init__(self, children):
        i = 0
        if isinstance(children[i], Qualifiers):
            self.qualifiers = children[i]
            i += 1
        else:
            self.qualifiers = None
        
        self.data_type = children[i]
        i += 1

        self.identifier = children[i]
        i += 1

        if i < len(children) and isinstance(children[i], ArrayModifier):
            self.array_modifier = children[i]
            i += 1
        else:
            self.array_modifier = None
        
        if i < len(children) and isinstance(children[i], Initializer):
            self.initializer = children[i]
            i += 1
        else:
            self.initializer = None
    
    def emit(self, language, indent=0):
        a = "" if self.qualifiers is None else f"{self.qualifiers.emit(language)} "
        b = self.data_type.emit(language)
        c = self.identifier.emit(language)
        d = "" if self.array_modifier is None else self.array_modifier.emit(language)
        e = "" if self.initializer is None else " " + self.initializer.emit(language)

        if language == "glsl":
            return f"{a}{b} {c}{d}{e}"
        else:
            return f"let {c}: {b}{d}{e}"

class Qualifiers(Node):
    def __init__(self, children):
        self.children = children
    
    def emit(self, language, indent=0):
        return " ".join(self.children)
    
class ArrayModifier(UnaryOperation):
    def emit(self, language, indent=0):
        if self.value is None:
            return "[]"
        else:
            return f"[int({self.value.emit(language)})]"
        
class Initializer(UnaryOperation):
    def emit(self, language, indent=0):
        return f"= {self.value.emit(language)}"

class Block(Node):
    def __init__(self, statements):
        self.statements = statements
    
    def emit(self, language, indent=0):
        fn = lambda x: x.emit(language, indent + 1)
        return f"{{\n{''.join(map(fn, self.statements))}{margin(indent)}}}\n"

class ExpressionStatement(Node):
    def __init__(self, expression):
        self.expression = expression
    
    def emit(self, language, indent=0):
        return f"{margin(indent)}{self.expression.emit(language, 0)};\n"

class IfStatement(Node):
    def __init__(self, condition, if_true, if_false):
        self.condition = condition
        self.if_true = if_true
        self.if_false = if_false
    
    def emit(self, language, indent=0):
        first, rest = (indent if isinstance(indent, list) else [indent, indent])
        c = self.condition.emit(language, 0)
        b = self.if_true.emit(language, rest)
        if self.if_false is None:
            return f"{margin(first)}if ({c}) {b}"
        else:
            e = self.if_false.emit(
                language, 
                indent=([0, indent] if isinstance(self.if_false, IfStatement) else rest))
            return f"{margin(first)}if ({c}) {b}{margin(rest)}else {e}"

class WhileStatement(Node):
    def __init__(self, condition, body):
        self.condition = condition
        self.body = body
    
    def emit(self, language, indent=0):
        c = self.condition.emit(language, 0)
        b = self.body.emit(language, indent)
        return f"{margin(indent)}while ({c}) {b}"
        
class ForStatement(Node):
    def __init__(self, initializer, condition, increment, body):
        self.initializer = initializer
        self.condition = condition
        self.increment = increment
        self.body = body
    
    def emit(self, language, indent=0):
        a = "" if isinstance(self.initializer, str) else self.initializer.emit(language, 0)
        b = "" if isinstance(self.condition, str) else self.condition.emit(language, 0)
        c = "" if isinstance(self.increment, str) else self.increment.emit(language, 0)
        d = self.body.emit(language, indent)
        return f"{margin(indent)}for ({a}; {b}; {c}) {d}"


class SimpleStatement(Node):
    def __init__(self, keyword):
        self.keyword = keyword
    
    def emit(self, language, indent=0):
        if language == "ts" and self.keyword == "discard":
            return "throw new RT.DiscardException();\n";
        
        return f"{margin(indent)}{self.keyword};\n"

class ReturnStatement(UnaryOperation):
    def emit(self, language, indent=0):
        value = '' if self.value is None else ' ' + self.value.emit(language)
        return f"{margin(indent)}return{value};\n"

class Conditional(Node):
    def __init__(self, condition, if_true, if_false):
        self.condition = condition
        self.if_true = if_true
        self.if_false = if_false
    
    def emit(self, language, indent=0):
        return f"({self.condition.emit(language)} ? {self.if_true.emit(language)} : {self.if_false.emit(language)})"

class ManyOperations(Node):
    def __init__(self, sequence, operator=None):
        '''If operator not given, sequence is of form [value, op, value, op, value].
           Otherwise, sequence is a list of operands.'''
        self.sequence = sequence
        self.operator = operator

    def emit(self, language, indent=0):
        render_fn = lambda x: x if isinstance(x, str) else x.emit(language)
        intersperse = " " if self.operator is None else f"{self.operator}"
        return f"{intersperse.join(map(render_fn, self.sequence))}"

class PrefixOperation(UnaryOperation):
    def __init__(self, value, operation):
        self.value = value
        self.operation = operation

    def emit(self, language, indent=0):
        return f"{self.operation}{self.value.emit(language)}"


class Negation(UnaryOperation):
    def emit(self, language, indent=0):
        return f"-{self.value.emit(language)}"

class LogicalNot(UnaryOperation):
    def emit(self, language, indent=0):
        return f"!{self.value.emit(language)}"

class Increment(UnaryOperation):
    def emit(self, language, indent=0):
        return f"{self.value.emit(language)}++"

class Decrement(UnaryOperation):
    def emit(self, language, indent=0):
        return f"{self.value.emit(language)}--"

class Indexed(BinaryOperation):
    def emit(self, language, indent=0):
        if language == "glsl":
            return f"{self.left.emit(language)}[int({self.right.emit(language)})]"
        else:
            return f"{self.left.emit(language)}[{self.right.emit(language)}]"

class FunctionCall(BinaryOperation):
    def emit(self, language, indent=0):
        left = self.left.emit(language)

        if language == "ts" and left in REWRITE_CALLS:
            left = REWRITE_CALLS[left]

        return f"{left}({', '.join(map(lambda a: a.emit(language), self.right))})"

class FieldSelection(BinaryOperation):
    def emit(self, language, indent=0):
        if language == 'glsl':
            return f"{self.left.emit(language)}.{self.right.emit(language)}"
        else:
            field = self.right.emit(language)
            if field in ["x", "y", "z", "w"]:
                return f"{self.left.emit(language)}.{self.right.emit(language)}"
            else:
                return f"RT.field({self.left.emit(language)}, \"{self.right.emit(language)}\")"

class Group(UnaryOperation):
    def emit(self, language, indent=0):
        return f"({self.value.emit(language)})"

class Identifier(UnaryOperation):
    def emit(self, language, indent=0):
        return self.value

class LiteralFloat(UnaryOperation):
    def emit(self, language, indent=0):
        s = str(self.value)
        if "." not in s:
            return s + ".0"
        else:
            return s



class Intermediate(Transformer):

    def top(self, c): return Top(c)
    def level_container(self, c): return LevelContainer(c)
    def renderer_container(self, c): return RendererContainer(c)

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

    def array_type(self, c): return ArrayType(c[0], c[1])
    def function_declaration(self, c): return FunctionDeclaration(c[0], c[1], c[2], c[3])
    def parameters(self, c): return ManyOperations(c, operator=", ")
    def parameter(self, c): return Parameter(c[0], c[1])
    def var_declaration(self, c): return VariableDeclaration(c)
    def qualifiers(self, c): return Qualifiers(c)
    def constant(self, c): return "const"
    def uniform(self, c): return "uniform"
    def array_mod(self, c): return ArrayModifier(c[0] if len(c) > 0 else None)
    def initializer(self, c): return Initializer(c[0])

    def block(self, c): return Block(c)
    def expression_statement(self, c): return ExpressionStatement(c[0] if len(c) > 0 else None)
    def var_decl_stmt(self, c): return ExpressionStatement(c[0])
    def if_statement(self, c): return IfStatement(c[0], c[1], c[2] if len(c) > 2 else None)
    def for_statement(self, c): return ForStatement(c[0], c[1], c[2], c[3])
    def fs_interior(self, c): return ""
    def while_statement(self, c): return WhileStatement(c[0], c[1])
    def continue_statement(self, c): return SimpleStatement("continue")
    def break_statement(self, c): return SimpleStatement("break")
    def return_statement(self, c): return ReturnStatement(c[0] if len(c) > 0 else None)
    def discard_statement(self, c): return SimpleStatement("discard")

    def assignment(self, c): return ManyOperations(c)
    def conditional(self, c): return Conditional(c[0], c[1], c[2])
    def or_expression(self, c): return ManyOperations(c, operator=" || ")
    def and_expression(self, c): return ManyOperations(c, operator=" && ")
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



def read_file(filename):
    with open(filename, "r") as f:
        content = f.read()
    return content

def make_parser():
    grammar = read_file("level_grammar.lark")
    return Lark(grammar, start="top", parser="lalr", transformer=Intermediate())

def list_files(directory):
    return [
        join(directory, f) 
        for f in listdir(directory) if isfile(join(directory, f))
    ]


def identify_source_files():
    files = []
    files.extend(list_files("./src/levels"))
    files.extend(list_files("./src/gpu"))
    return files



parser = make_parser()

with open("./src/built/index.ts", "w") as index:
    index.write("let levels: Map<string, string[]> = new Map();\n")
    index.write("let renderers: Map<string, string[]> = new Map();\n\n")

    for file in identify_source_files():
        text = read_file(file)
        tree = parser.parse(text)

        if isinstance(tree, Top):
            base = basename(file)
            id = base[0:base.index(".")]

            if tree.level is not None:
                print(f"Level GLSL {id}")
                top, body = tree.level.emit("glsl")

                output_file = f"{id}.level"
                output_path = f"./src/built/{output_file}.ts"
                with open(output_path, "w") as handle:
                    handle.write(f"export const level_{id} = [`\n{top}\n`, `\n{body}\n`];")

                index.write(f"import {{ level_{id} }} from \"./{output_file}\";\n")
                index.write(f"levels.set(\"{id}\", level_{id});\n")

                print(f"Level TS {id}")
                code = tree.level.emit("ts")

                output_file = f"{id}.native"
                output_path = f"./src/built/{output_file}.ts"
                with open(output_path, "w") as handle:
                    handle.write(f"{code}\n")



            if tree.renderer is not None:
                print(f"Renderer GLSL {id}")
                top, body = tree.renderer.emit("glsl")

                output_file = f"{id}.renderer"
                output_path = f"./src/built/{output_file}.ts"
                with open(output_path, "w") as handle:
                    handle.write(f"export const renderer_{id} = [`\n{top}\n`, `\n{body}\n`];")

                index.write(f"import {{ renderer_{id} }} from \"./{output_file}\";\n")
                index.write(f"renderers.set(\"{id}\", renderer_{id});\n")
    
    index.write("\nconst BUILT = {\n")
    index.write("    levels: levels,\n")
    index.write("    renderers: renderers,\n")
    index.write("};\n");
    index.write("export default BUILT;\n")
    
