import functools
from dataclasses import dataclass
from typing import Any, Dict
from lark import Lark, Transformer
from os import listdir
from os.path import isfile, join, basename
import pprint as pp
from common import * 
import expression_graph as eg





def link(me, child):
    if isinstance(child, Node):
        child.parent = me
    if isinstance(child, list):
        for item in child:
            link(me, item)

class Node:
    def emit(self, language, indent=0):
        raise NotImplementedError()

    def __repr__(self):
        return self.emit("glsl")

    def get_symbol_from_own_table(self, symbol):
        return None

    def get_symbol(self, symbol):
        current = self
        while current is not None:
            self_check = current.get_symbol_from_own_table(symbol)
            if self_check is not None:
                return { "type": self_check, "node": current }
            current = current.parent

        return None

    def gather_symbols(self):
        pass

    def register_symbol_in_own_table(self, name, type_information):
        return False

    def declare_symbol(self, name, type_information):
        current = self
        while current is not None:
            result = current.register_symbol_in_own_table(name, type_information)
            if result:
                return True
            current = current.parent
        
        raise Exception("could not declare symbol")

    def expression_graph(self):
        raise NotImplementedError()



class UnaryOperation(Node):
    def __init__(self, value):
        link(self, value)
        self.value = value

    def eg_formatter(self):
        raise NotImplementedError()

    def eg_result_type(self, input_type):
        return input_type

    def expression_graph(self):
        value = self.value.expression_graph()
        dt = value.get_single_output().data_type
        current = eg.n_unary(self.eg_formatter(), dt, self.eg_result_type(dt))
        value.send(None, current, "value")
        return current

class BinaryOperation(Node):
    def __init__(self, left, right, center=None):
        link(self, left)
        link(self, right)
        link(self, center)
        self.left = left
        self.right = right
        self.center = center

    def emit(self, language, indent=0):
        if self.center is None:
            raise "BinaryOperation with no center must override emit()"
        return f"{self.left.emit(language)} {self.center.emit(language)} {self.right.emit(language)}"


class Top(Node):
    def __init__(self, children):
        self.parent = None
        self.level = None
        self.renderer = None

        for c in children:
            link(self, c)
            if isinstance(c, LevelContainer):
                self.level = c
            if isinstance(c, RendererContainer):
                self.renderer = c
        
        self.gather_symbols()
    
    def gather_symbols(self):
        if self.level is not None:
            self.level.gather_symbols()
        if self.renderer is not None:
            self.renderer.gather_symbols()


class ShaderContainer(Node):
    def __init__(self, children):
        self.children = children
        self.table = dict()

        for c in self.children:
            link(self, c)
    
    def get_symbol_from_own_table(self, symbol):
        if symbol in self.table:
            return self.table[symbol]
        else:
            return None

    def register_symbol_in_own_table(self, name, type_information):
        self.table[name] = type_information
        return True

    def gather_symbols(self):
        for c in self.children:
            c.gather_symbols()

    def emit(self, language, indent=0):
        top = []
        body = []

        for c in self.children:
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
        body.append("import * as RT from \"../shader_runtime\";")
        body.append("")
        body.append("export class Level {")

        for c in self.children:
            body.append(c.emit(language, indent=1))
        
        body.append("}")

        return '\n'.join(body);

class RendererContainer(ShaderContainer):
    pass

class PrimitiveType(UnaryOperation):
    def emit(self, language, indent=0):
        primitive = str(self.value)
        if language == "ts":
            if primitive in TS_TYPES:
                return TS_TYPES[primitive]
        return primitive

class ArrayType(BinaryOperation):
    def emit(self, language, indent=0):
        return f"{self.left.emit(language)}{self.right.emit(language)}"

class FunctionDeclaration(Node):
    def __init__(self, return_type, identifier, parameters, block):
        link(self, return_type)
        link(self, identifier)
        link(self, parameters)
        link(self, block)
        self.return_type = return_type
        self.identifier = identifier
        self.parameters = parameters
        self.block = block
    
    def gather_symbols(self):
        type_name = self.return_type.emit("glsl")
        if type_name not in REWRITE_TYPES:
            raise "unknown return type from function declaration ({type_name})"

        self.declare_symbol(
            self.identifier.emit("glsl"),
            REWRITE_TYPES[type_name]
        )

        self.parameters.gather_symbols()
        self.block.gather_symbols()
    
    def get_clone_statements(self, indent):
        statements = []
        for p in self.parameters.children:
            type_name = p.left.emit("glsl")
            variable = p.right.emit("glsl")
            if type_name in TS_TYPES and TS_TYPES[type_name] == "number[]":
                statements.append(f"{margin(indent)}{variable} = ({variable}).slice();\n")
            
        return statements
        

    
    def emit(self, language, indent=0):
        a = self.return_type.emit(language)
        b = self.identifier.emit(language)
        c = self.parameters.emit(language)
        d = self.block.emit(language, indent)

        if language == "glsl":
            return f"{margin(indent)}{a} {b}({c}) {d}"
        else:
            return f"{margin(indent)}{b}({c}): {a} {d}"

class Parameters(Node):
    def __init__(self, children):
        self.children = children
        for c in self.children:
            link(self, c)

    def gather_symbols(self):
        for c in self.children:
            c.gather_symbols()
    
    def emit(self, language, indent=0):
        return ", ".join(map(lambda x: x.emit(language), self.children))
    
class Parameter(BinaryOperation):
    def gather_symbols(self):
        type_name = self.left.emit("glsl")
        if type_name not in REWRITE_TYPES:
            raise TypeError("unknown parameter type ({type_name})")

        if not isinstance(self.parent, Parameters) or \
            not isinstance(self.parent.parent, FunctionDeclaration) or \
            not isinstance(self.parent.parent.block, Block):
                raise Exception("internal error: unexpected ast structure around parameter")

        self.parent.parent.block.declare_symbol(
            self.right.emit("glsl"),
            REWRITE_TYPES[type_name]
        )

    def emit(self, language, indent=0):
        if language == "glsl":
            return f"{self.left.emit(language)} {self.right.emit(language)}"
        else:
            return f"{self.right.emit(language)}: {self.left.emit(language)}"

    

class VariableDeclaration(Node):
    def __init__(self, children):
        link(self, children)

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

    def gather_symbols(self):
        type_name = self.data_type.emit("glsl")
        if type_name not in REWRITE_TYPES:
            raise "unknown data type of variable ({type_name})"

        self.declare_symbol(
            self.identifier.emit("glsl"),
            REWRITE_TYPES[type_name]
        )
    
    def emit(self, language, indent=0):
        a = "" if self.qualifiers is None else f"{self.qualifiers.emit(language)} "
        b = self.data_type.emit(language)
        c = self.identifier.emit(language)
        d = "" if self.array_modifier is None else self.array_modifier.emit(language)
        
        if language == "glsl":
            e = "" if self.initializer is None else " " + self.initializer.emit(language)
            if "uniform" in a:
                e = ""

            return f"{a}{b} {c}{d}{e}"
        else:
            prefix = "let "
            if "const" in a:
                prefix = "readonly "
            if "uniform" in a:
                prefix = ""
            
            
            if self.initializer is None:
                return f"{prefix}{c}: {b}{d}"
            elif "const" not in a:
                generator = self.initializer.emit(language)
                output_name = generator.get_single_output()
                return [generator, f"{prefix}{c}: {b}{d} = {output_name}"]
            else:
                generator = self.initializer.emit(language)
                return (f"{prefix}{c}: {b}{d} = (() => {{\n"
                    f"{generator.all_lines(indent + 1)}{margin(indent + 1)}"
                    f"return {generator.get_single_output()};\n"
                    f"{margin(indent)}}})()")


class Qualifiers(Node):
    def __init__(self, children):
        self.children = children
        link(self, children)
    
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
        if language == "glsl":
            return f"= {self.value.emit(language)}"
        else:
            return self.value.emit(language)  # the CodeGenerator for the expression
            

class Block(Node):
    def __init__(self, statements):
        link(self, statements)
        self.statements = statements
        self.table = dict()
    
    def gather_symbols(self):
        for s in self.statements:
            s.gather_symbols()

    def get_symbol_from_own_table(self, symbol):
        if symbol in self.table:
            return self.table[symbol]
        else:
            return None

    def register_symbol_in_own_table(self, name, type_information):
        self.table[name] = type_information
        return True
    
    def emit(self, language, indent=0):
        fn = lambda x: x.emit(language, indent + 1)
        if language == 'glsl':
            s = map(fn, self.statements)
        else:
            s = []
            if isinstance(self.parent, FunctionDeclaration):
                s.extend(self.parent.get_clone_statements(indent + 1))
            s.extend(map(fn, self.statements))
        
        return f"{{\n{''.join(s)}{margin(indent)}}}\n"

class ExpressionStatement(Node):
    def __init__(self, expression):
        link(self, expression)
        self.expression = expression

    def gather_symbols(self):
        self.expression.gather_symbols()
    
    def emit(self, language, indent=0):
        if self.expression is None:
            return ""
        
        expression = self.expression.emit(language, indent)

        if isinstance(expression, str):
            return f"{margin(indent)}{expression};\n"
        elif isinstance(expression, list): # [generator, last line]
            generator = expression[0]
            return (f"{generator.all_lines(indent)}{margin(indent)}{expression[1]};\n")
        elif isinstance(expression, eg.CodeGenerator):
            return expression.all_lines(indent)
        else:
            raise TypeError(f"unknown type {type(expression).__name__} as expression return")
            

class IfStatement(Node):
    def __init__(self, children):
        for c in children:
            link(self, c)

        self.branches = []
        i = 0
        has_else = False

        while i < len(children):
            if isinstance(children[i], Expression):
                if i + 1 >= len(children):
                    raise Exception("parser has returned malformed ast in if")
                if has_else:
                    raise Exception("if/else if after else")
                self.branches.append(["if" if len(self.branches) == 0 else "else if", children[i], children[i + 1]])
                i += 2
            elif isinstance(children[i], Block):
                if has_else:
                    raise Exception("two else branches in a single if block")
                self.branches.append(["else", None, children[i]])
                has_else = True
                i += 1
            else:
                print(children[i])
                raise Exception("unknown if statement child")
    
    def gather_symbols(self):
        for b in self.branches:
            for i in range(1, len(b)):
                if b[i] is not None:
                    b[i].gather_symbols()

    def emit(self, language, indent=0):
        if language == "glsl":
            condition = lambda b: ('' if b[1] is None else f" ({b[1].emit(language, 0)})")
            return "".join([
                f"{margin(indent)}{b[0]}{condition(b)} {b[2].emit(language, indent)}"
                for b in self.branches
            ])
        else:   # TODO: guard against side effects in conditions, e.g. if (x = 5) { ... }
            result = ""
            for b in self.branches:
                if b[1] is not None:
                    generator = b[1].emit(language, 0)
                    result += generator.all_lines(indent)
                    b.append(generator.get_single_output())

            condition = lambda b: ('' if b[1] is None else f" ({b[3]})")
            result += "".join([
                f"{margin(indent)}{b[0]}{condition(b)} {b[2].emit(language, indent)}"
                for b in self.branches
            ])
            return result


            


        

class WhileStatement(Node):
    def __init__(self, condition, body):
        link(self, condition)
        link(self, body)
        self.condition = condition
        self.body = body

    def gather_symbols(self):
        self.body.gather_symbols()
    
    def emit(self, language, indent=0):
        if language == "glsl":
            c = self.condition.emit(language, 0)
            b = self.body.emit(language, indent)
            return f"{margin(indent)}while ({c}) {b}"
        else:
            b = self.condition.emit(language, 0)
            d = self.body.emit(language, indent + 1)

            lines = f"{margin(indent)}while (true) {{\n"

            if b is not None:
                lines += b.all_lines(indent + 1)
                lines += f"{margin(indent + 1)}if (!{b.get_single_output()}) break;\n"
            
            lines += f"{margin(indent+1)}{d}"
            lines += f"{margin(indent)}}}\n"
            
            return lines
        
class ForStatement(Node):
    def __init__(self, initializer, condition, increment, body):
        link(self, initializer)
        link(self, condition)
        link(self, increment)
        link(self, body)
        self.initializer = initializer
        self.condition = condition
        self.increment = increment
        self.body = body
    
    def gather_symbols(self):
        self.initializer.gather_symbols()
        self.body.gather_symbols()
    
    def emit(self, language, indent=0):
        

        if language == "glsl":
            a = "" if isinstance(self.initializer, str) else self.initializer.emit(language, 0)
            b = "" if isinstance(self.condition, str) else self.condition.emit(language, 0)
            c = "" if isinstance(self.increment, str) else self.increment.emit(language, 0)
            d = self.body.emit(language, indent)

            return f"{margin(indent)}for ({a}; {b}; {c}) {d}"
        else:
            a = None if isinstance(self.initializer, str) else self.initializer.emit(language, 0)
            b = None if isinstance(self.condition, str) else self.condition.emit(language, 0)
            c = None if isinstance(self.increment, str) else self.increment.emit(language, 0)
            d = self.body.emit(language, indent + 1)

            lines = ""

            if a is not None:
                if isinstance(a, list):
                    generator = a[0]
                    lines += generator.all_lines(indent)
                    lines += f"{margin(indent)}{a[1]};\n"
                elif isinstance(a, eg.CodeGenerator):
                    lines += a.all_lines(indent)
                else:
                    lines += a

            lines += f"{margin(indent)}while (true) {{\n"

            if b is not None:
                lines += b.all_lines(indent + 1)
                lines += f"{margin(indent + 1)}if (!{b.get_single_output()}) break;\n"
            
            lines += f"{margin(indent+1)}{d}"

            if c is not None:
                lines += c.all_lines(indent + 1)

            lines += f"{margin(indent)}}}\n"
            
            return lines


class SimpleStatement(Node):
    def __init__(self, keyword):
        link(self, keyword)
        self.keyword = keyword
    
    def emit(self, language, indent=0):
        if language == "ts" and self.keyword == "discard":
            return "throw new RT.DiscardException();\n";
        
        return f"{margin(indent)}{self.keyword};\n"

class ReturnStatement(UnaryOperation):
    def emit(self, language, indent=0):
        if language == "glsl":
            value = '' if self.value is None else f' {self.value.emit(language)}'
            return f"{margin(indent)}return{value};\n"
        else:
            generator = self.value.emit(language)
            return (f"{generator.all_lines(indent)}{margin(indent)}"
                    f"return {generator.get_single_output()};\n")

        



class Expression(Node):
    def __init__(self, expression):
        link(self, expression)
        self.expression = expression

    def emit(self, language, indent=0):
        if language == 'glsl':
            return self.expression.emit('glsl')
        else:
            terminal = self.expression.expression_graph()
            generator = eg.CodeGenerator(terminal)
            return generator

    def expression_graph(self):
        return self.expression.expression_graph()

class Conditional(Node):
    def __init__(self, condition, if_true, if_false):
        link(self, condition)
        link(self, if_true)
        link(self, if_false)
        self.condition = condition
        self.if_true = if_true
        self.if_false = if_false
    
    def emit(self, language, indent=0):
        return f"({self.condition.emit(language)} ? {self.if_true.emit(language)} : {self.if_false.emit(language)})"

    def expression_graph(self):
        condition = self.condition.expression_graph()
        if_true = self.if_true.expression_graph()
        if_false = self.if_false.expression_graph()

        current = eg.n_branch(if_true.get_single_output().data_type)

        condition.send(None, current, "condition")
        if_true.send(None, current, "if_true")
        if_false.send(None, current, "if_false")

        return current
        

class ManyOperations(Node):
    def __init__(self, sequence, operator=None):
        '''If operator not given, sequence is of form [value, op, value, op, value].
           Otherwise, sequence is a list of operands.'''
        link(self, sequence)
        link(self, operator)
        self.sequence = sequence
        self.operator = operator

    def emit(self, language, indent=0):
        render_fn = lambda x: x if isinstance(x, str) else x.emit(language)
        intersperse = " " if self.operator is None else f"{self.operator}"
        return f"{intersperse.join(map(render_fn, self.sequence))}"

    def eg_result_type(self, op):
        if op in ["<", ">", "<=", ">=", "==", "!=", "&&", "||"]:
            return BooleanType()
        return None

    def left_associative(self, op):
        if op in ["=", "*=", "/=", "%=", "+=", "-="]:
            return False
        return True

    def eg_normalize_structure(self):
        stages = []
        if self.operator is None:
            if self.left_associative(self.sequence[1]):
                stages.append([self.sequence[0], self.sequence[1], self.sequence[2]])
                for i in range(3, len(self.sequence), 2):
                    stages.append([None, self.sequence[i], self.sequence[i + 1]])
            else:
                e = len(self.sequence) - 1
                stages.append([self.sequence[e - 2], self.sequence[e - 1], self.sequence[e]])
                for i in range(e - 3, -1, -2):
                    stages.append([self.sequence[i - 1], self.sequence[i], None])
        else:
            op = self.operator.strip()
            if self.left_associative(op):
                stages.append([self.sequence[0], op, self.sequence[1]])
                for i in range(2, len(self.sequence), 1):
                    stages.append([None, op, self.sequence[i]])
            else:
                e = len(self.sequence) - 1
                stages.append([self.sequence[e - 1], op, self.sequence[e]])
                for i in range(e - 2, -1, -1):
                    stages.append([self.sequence[i], op, None])

        return stages

    def expression_graph(self):
        stages = self.eg_normalize_structure()
        previous = None

        for stage in stages:
            left = (previous if stage[0] is None else stage[0].expression_graph())
            right = (previous if stage[2] is None else stage[2].expression_graph())

            dt_left = left.get_single_output().data_type
            dt_right = right.get_single_output().data_type

            current = eg.n_binary(
                lambda a,b,o=stage[1]: f"{a}{o}{b}",
                dt_left, dt_right, self.eg_result_type(stage[1]))

            left.send(None, current, "left")
            right.send(None, current, "right")
            previous = current

        return previous



class PrefixOperation(UnaryOperation):
    def __init__(self, value, operation):
        link(self, value)
        link(self, operation)
        self.value = value
        self.operation = operation

    def emit(self, language, indent=0):
        return f"{self.operation}{self.value.emit(language)}"

    def eg_formatter(self): return lambda v,o=self.operation: f"{o}{v}"

    def eg_result_type(self, input_type): 
        if self.operation == "!":
            return BooleanType()
        else:
            return input_type


class Increment(UnaryOperation):
    def emit(self, language, indent=0):
        return f"{self.value.emit(language)}++"

    def eg_formatter(self): return lambda v: f"{v}++"

class Decrement(Increment):
    def emit(self, language, indent=0):
        return f"{self.value.emit(language)}--"

    def eg_formatter(self): return lambda v: f"{v}--"


class Indexed(BinaryOperation):
    def emit(self, language, indent=0):
        if language == "glsl":
            return f"{self.left.emit(language)}[int({self.right.emit(language)})]"
        else:
            return f"{self.left.emit(language)}[{self.right.emit(language)}]"

    def expression_graph(self):
        raise NotImplementedError()   # TODO arrays



class FunctionCall(BinaryOperation):
    def emit(self, language, indent=0):
        left = self.left.emit(language)

        if language == 'glsl':
            return f"{left}({', '.join(map(lambda a: a.emit(language), self.right))})"
        elif left in ["vec2", "vec3", "vec4"]:
            pass
        raise "todo"

    def expression_graph(self):
        fn = self.left.emit('glsl')
        arguments = list(map(lambda x: x.expression_graph(), self.right))

        if fn in REWRITE_TYPES:
            return self.eg_constructor(REWRITE_TYPES[fn], arguments)
        elif fn in REWRITE_CALLS:
            return self.eg_library_function(REWRITE_CALLS[fn], arguments)
        else:
            return self.eg_actual_function_call(fn, arguments)
            
    def eg_constructor(self, dt, arguments):
        if dt == VoidType():
            raise TypeError("cannot cast to void")
        elif dt == IntegerType():
            if len(arguments) != 1:
                raise ValueError("int constructor requires exactly 1 argument")
            dt_in = arguments[0].get_single_output().data_type
            if dt_in.arity() != 1:
                raise TypeError("int constructor requires scalar argument")
            current = eg.n_call("Math.floor", [dt_in], dt)
            arguments[0].send(None, current, "input_0")
            return current
        else:
            if len(arguments) == 0:
                raise ValueError(f"{dt} constructor requires at least one argument")
            
            if len(arguments) == 1 and arguments[0].get_single_output().data_type.arity() == 1:
                if isinstance(dt, VectorType):
                    current = eg.n_reflow(
                        [arguments[0].get_single_output().data_type],
                        [dt],
                        indices=[0 for i in range(dt.arity())])
                    arguments[0].send(None, current, f"input_0")
                    return current
                elif isinstance(dt, MatrixType):
                    raise NotImplementedError()
            
            current = eg.n_reflow(
                list(map(lambda a: a.get_single_output().data_type, arguments)),
                [dt])
            for i in range(len(arguments)):
                arguments[i].send(None, current, f"input_{i}")
            return current



    def eg_library_function(self, call_info, arguments):
        function_name = call_info[0]
        variety = call_info[1]

        if variety == DISTRIBUTE or variety == ACCUMULATE:
            dt_single = None
            dt_vector = None

            for a in arguments:
                dt = a.get_single_output().data_type
                if dt.arity() == 1:
                    if dt_single is None:
                        dt_single = dt
                    elif dt_single != dt:
                        raise TypeError(f"inconsistent scalar types in call to {function_name}")
                elif isinstance(dt, VectorType):
                    if dt_vector is None:
                        dt_vector = dt
                    elif dt_vector != dt:
                        raise TypeError(f"inconsistent vector types in call to {function_name}")
            
            if dt_single is not None and dt_vector is not None and \
                dt_single.primitive_type() != dt_vector.primitive_type():
                    raise TypeError(f"incompatible primitive types in call to {function_name}")

            dt_output = dt_vector if dt_vector is not None else dt_single
            if variety == ACCUMULATE:
                dt_output = dt_output.primitive_type()

            current = eg.n_call(function_name, \
                list(map(lambda a: a.get_single_output().data_type, arguments)), \
                dt_output, \
                eg.f_call_distribute if variety == DISTRIBUTE else eg.f_call)
            
            for i, a in enumerate(arguments):
                a.send(None, current, f"input_{i}")

            return current
        else:
            if variety == VEC3_VEC3:
                need = 2
                bad_types = arguments[0].get_single_output().data_type.arity() != 3 or \
                    arguments[1].get_single_output().data_type.arity() != 3
                out_type = VectorType(FloatType(), 3)
            elif variety == VEC_VEC_MAT:
                need = 2
                bad_types = arguments[0].get_single_output().data_type.arity() != \
                    arguments[1].get_single_output().data_type.arity() or \
                    not isinstance(arguments[0].get_single_output().data_type, VectorType)
                out_type = MatrixType(arguments[0].get_single_output().data_type.arity())
            elif variety == MAT_MAT:
                need = 1
                bad_types = not isinstance(arguments[0].get_single_output().data_type, MatrixType)
                out_type = arguments[0].get_single_output().data_type
            else:
                raise TypeError("unknown library function variety")
            if len(arguments) != need:
                raise ValueError(f"function {function_name} has wrong number of arguments")

            if bad_types:
                    raise ValueError(f"function {function_name} has incorrect argument type")

            current = eg.n_call(function_name, \
                list(map(lambda a: a.get_single_output().data_type, arguments)), \
                out_type, \
                eg.f_call)

            for i, a in enumerate(arguments):
                a.send(None, current, f"input_{i}")

            return current
        
        

    def eg_actual_function_call(self, name, arguments):
        symbol = self.get_symbol(name)
        if symbol is None:
            raise ValueError(f"function {name} not found")
            
        data_type = symbol["type"]
        prefix = "this." if isinstance(symbol["node"], ShaderContainer) else ""

        if data_type is None:
            raise Exception(f"function {self.left} not found")

        current = eg.n_call(prefix + name, \
                list(map(lambda a: a.get_single_output().data_type, arguments)), \
                data_type, \
                eg.f_call)

        for i, a in enumerate(arguments):
            a.send(None, current, f"input_{i}")

        return current


FIELDS = {
    "x": 0, "y": 1, "z": 2, "w": 3,
    "r": 0, "g": 1, "b": 2, "a": 3,
    "s": 0, "t": 1, "p": 2, "q": 3
}

class FieldSelection(BinaryOperation):
    def emit(self, language, indent=0):
        return f"{self.left.emit(language)}.{self.right.emit(language)}"

    def expression_graph(self):
        indices = []
        for c in self.right.emit('glsl'):
            if c not in FIELDS:
                raise ValueError("swizzle contains unrecognized character {c}")
            indices.append(FIELDS[c])
        
        if len(indices) < 1 or len(indices) > 4:
            raise ValueError(f"swizzle contains invalid number of characters ({len(indices)})")

        left = self.left.expression_graph()
        current = eg.n_reflow(
            [left.get_single_output().data_type],
            [FloatType() if len(indices) == 1 else VectorType(FloatType(), len(indices))], 
            indices=indices)

        left.send(None, current, "input_0")
        
        return current
            

class Group(UnaryOperation):
    def emit(self, language, indent=0):
        return f"({self.value.emit(language)})"

    def expression_graph(self):
        return self.value.expression_graph()

class Identifier(UnaryOperation):
    def emit(self, language, indent=0):
        return self.value

    def expression_graph(self):
        symbol = self.get_symbol(self.value)
        data_type = symbol["type"]
        prefix = "this." if isinstance(symbol["node"], ShaderContainer) else ""

        if data_type is None:
            raise Exception(f"identifier {self.value} not found")
        return eg.n_identifier(prefix + self.value, data_type)

class LiteralFloat(UnaryOperation):
    def emit(self, language, indent=0):
        s = str(self.value)
        if "." not in s:
            return s + ".0"
        else:
            return s

    def expression_graph(self):
        return eg.n_float(str(self.value))



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
    def parameters(self, c): return Parameters(c)
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
    def if_statement(self, c): return IfStatement(c)
    def for_statement(self, c): return ForStatement(c[0], c[1], c[2], c[3])
    def fs_interior(self, c): return ""
    def while_statement(self, c): return WhileStatement(c[0], c[1])
    def continue_statement(self, c): return SimpleStatement("continue")
    def break_statement(self, c): return SimpleStatement("break")
    def return_statement(self, c): return ReturnStatement(c[0] if len(c) > 0 else None)
    def discard_statement(self, c): return SimpleStatement("discard")

    def expression(self, c): return Expression(c[0])
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
    grammar = read_file("./compiler/level_grammar.lark")
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
    index.write("import { NativeLevel } from \"../shader_runtime\";\n")
    index.write("let levels: Map<string, string[]> = new Map();\n")
    index.write("let renderers: Map<string, string[]> = new Map();\n")
    index.write("let natives: Map<string, any> = new Map();\n\n")

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
                index.write(f"levels.set(\"{id}\", level_{id});\n\n")

                print(f"Level TS {id}")
                code = tree.level.emit("ts")

                output_file = f"{id}.native"
                output_path = f"./src/built/{output_file}.ts"
                with open(output_path, "w") as handle:
                    handle.write(f"{code}\n")

                index.write(f"import {{ Level as SDF_{id} }} from \"./{output_file}\";\n")
                index.write(f"natives.set(\"{id}\", new SDF_{id}());\n\n")


            if tree.renderer is not None:
                print(f"Renderer GLSL {id}")
                top, body = tree.renderer.emit("glsl")

                output_file = f"{id}.renderer"
                output_path = f"./src/built/{output_file}.ts"
                with open(output_path, "w") as handle:
                    handle.write(f"export const renderer_{id} = [`\n{top}\n`, `\n{body}\n`];")

                index.write(f"import {{ renderer_{id} }} from \"./{output_file}\";\n")
                index.write(f"renderers.set(\"{id}\", renderer_{id});\n\n")
    
    index.write("\nconst BUILT = {\n")
    index.write("    levels: levels,\n")
    index.write("    renderers: renderers,\n")
    index.write("    natives: natives,\n")
    index.write("};\n");
    index.write("export default BUILT;\n")
    
