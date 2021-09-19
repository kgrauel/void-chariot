import functools
from dataclasses import dataclass
from typing import Annotated, Any, Dict
import pprint as pp
from common import * 

FLOAT = FloatType()
INTEGER = IntegerType()
BOOLEAN = BooleanType()

next_id = 10

class Attachment:
    def __init__(self, data_type, node):
        self.data_type = data_type
        self.attachment = None
        self.node = node

class Node:
    def __init__(self, formatter, state=None, requires_dump=False):
        self.inputs = dict()
        self.outputs = dict()
        self.formatter = formatter
        self.state = state
        self.requires_dump = requires_dump

    def _append_vector(self, target_dictionary, name, arity, primitive):
        if arity == 1:
            target_dictionary[name] = Attachment(primitive, self)
        else:
            target_dictionary[name] = Attachment(VectorType(primitive, arity), self)

    def parameter(self, name, arity, primitive=FLOAT):
        self._append_vector(self.inputs, name, arity, primitive)
        return self
    
    def output(self, name, arity, primitive=FLOAT):
        self._append_vector(self.outputs, name, arity, primitive)
        return self

    def _append_matrix(self, target_dictionary, name, dimension):
        target_dictionary[name] = Attachment(MatrixType(dimension), self)

    def parameter_matrix(self, name, dimension):
        self._append_matrix(self.inputs, name, dimension)
        return self
    
    def output_matrix(self, name, dimension):
        self._append_matrix(self.outputs, name, dimension)
        return self

    def send(self, output_name, receiving_node, receiving_name):
        if output_name not in self.outputs:
            raise TypeError(f"output attachment {output_name} does not exist")
        if receiving_name not in receiving_node.inputs:
            raise TypeError(f"input attachment {receiving_name} does not exist")
        if self.outputs[output_name].data_type != receiving_node.inputs[receiving_name].data_type:
            raise TypeError(f"output data type {self.outputs[output_name].data_type} does not match "
                f"input data type {receiving_node.inputs[receiving_name].data_type}")

        self.outputs[output_name].attachment = receiving_node.inputs[receiving_name]
        receiving_node.inputs[receiving_name].attachment = self.outputs[output_name]




# FORMATTERS
#  Formatters take a dictionary of inputs matching those of their node types
#  The inputs may be an actual textual expression ("3 + 4", etc.) or a temp variable name
#    where the previous result was stored ("__temp01", etc.)
#  Returns a dictionary of expressions, one for each output.
#  Vector/array/matrix expressions output as Python lists [ ... ].
#  Output expressions should be substitutable, i.e. wrapped in parens if needed.

def f_as_string(n, inputs):
    return { "result": str(n.state["value"]) }

def f_binary_ss(n, inputs):
    left = inputs["left"]["result"]
    right = inputs["right"]["result"]
    return { "result": f"({left} {n.state['operation']} {right})" }

def f_binary_vv(n, inputs):
    left = inputs["left"]["result"]
    if not isinstance(left, list):
        left = list(map(lambda i: f"{left}[{i}]", range(n.inputs["left"].data_type.arity())))

    right = inputs["right"]["result"]
    if not isinstance(right, list):
        right = list(map(lambda i: f"{right}[{i}]", range(n.inputs["right"].data_type.arity())))

    paired = map(lambda x: f"({x[0]}{n.state['operation']}{x[1]})", zip(left, right))
    return { "result": list(paired) }

def f_binary_sv(n, inputs):
    left = inputs["left"]["result"]
    if isinstance(left, list):
        raise TypeError("scalar input is a list [...]")

    right = inputs["right"]["result"]
    if not isinstance(right, list):
        right = list(map(lambda i: f"{right}[{i}]", range(n.inputs["right"].data_type.arity())))

    paired = map(lambda x: f"({left}{n.state['operation']}{x})", right)
    return { "result": list(paired) }


# NODE CONSTRUCTORS

def n_float(value):
    return Node(f_as_string, {"value": value}).output("result", 1)

def n_integer(value):
    return Node(f_as_string, {"value": value}).output("result", 1, INTEGER)

def n_identifier(name, data_type):
    return Node(f_as_string, {"value": name}).output("result", 1, data_type)

def n_binary(op, dt1, dt2):
    if (isinstance(dt1, FloatType) and isinstance(dt2, FloatType)) \
        or (isinstance(dt1, IntegerType) and isinstance(dt2, IntegerType)):
            prim = dt1
            return Node(f_binary_ss, {"operation": op}) \
                .parameter("left", 1, prim).parameter("right", 1, prim).output("result", 1, prim)
    
    if isinstance(dt1, VectorType) and isinstance(dt2, VectorType):
        if dt1.arity() != dt2.arity():
            raise "vector types have differing arities"
        return Node(f_binary_vv, {"operation": op}) \
            .parameter("left", 1, dt1).parameter("right", 1, dt2).output("result", 1, dt1)

    if isinstance(dt1, VectorType) and isinstance(dt2, FloatType):
        return Node(f_binary_sv, {"operation": op}) \
            .parameter("left", 1, dt2).parameter("right", 1, dt1).output("result", 1, dt1)

    if isinstance(dt1, FloatType) and isinstance(dt2, VectorType):
        return Node(f_binary_sv, {"operation": op}) \
            .parameter("left", 1, dt1).parameter("right", 1, dt2).output("result", 1, dt2)
    
    raise ValueError(f"binary operator {op} not applicable to types {dt1}, {dt2}")



# OUTPUT

class CodeGenerator:
    def __init__(self, node):
        self.lines = []

        self.target_variable = self.build(node, force_dump=True)
    
    def generate_intermediate_name(self):
        global next_id
        result = f"_t{next_id}"
        next_id += 1
        return result

    def build(self, node, force_dump):
        inputs = dict()
        for k, pred in node.inputs.items():
            if pred.attachment is None:
                raise ValueError("missing attachment")
            inputs[k] = self.build(pred.attachment.node, node.requires_dump)
        
        outputs = node.formatter(node, inputs)
        
        if len(outputs) > 1 or force_dump:
            for k in outputs:
                out_code = outputs[k]
                if isinstance(out_code, list):
                    out_code = f"[{', '.join(out_code)}]"
                outputs[k] = self.generate_intermediate_name()
                self.lines.append(f"const {outputs[k]} = {out_code};")
        
        return outputs

def generate_code(node):
    generator = CodeGenerator(node)
    return {
        "code": "\n".join(generator.lines) + "\n",
        "output": generator.target_variable
    }





# TEST

def test():
    a = n_float(10)
    b = n_identifier("f", FLOAT)
    c = n_binary("-", FLOAT, FLOAT)

    a.send("result", c, "left")
    b.send("result", c, "right")

    print(generate_code(c))

    
    a = n_identifier("x", VectorType(FLOAT, 3))
    b = n_identifier("y", VectorType(FLOAT, 3))
    c = n_binary("-", VectorType(FLOAT, 3), VectorType(FLOAT, 3))

    d = n_float(10)
    e = n_binary("*", FLOAT, VectorType(FLOAT, 3))

    a.send("result", c, "left")
    b.send("result", c, "right")
    d.send("result", e, "left")
    c.send("result", e, "right")

    print(generate_code(e))
    
test()