import functools
from dataclasses import dataclass
from typing import Annotated, Any, Dict
import pprint as pp
from common import * 
from collections import deque

FLOAT = FloatType()
INTEGER = IntegerType()
BOOLEAN = BooleanType()

next_id = 10

class Attachment:
    def __init__(self, name, data_type, node):
        self.name = name
        self.data_type = data_type
        self.attachments = []
        self.node = node

    def add_attachment(self, target):
        self.attachments.append(target)

class Node:
    def __init__(self, formatter, state=None):
        global next_id

        self.id = str(next_id)
        next_id += 1

        self.inputs = dict()
        self.outputs = dict()
        self.formatter = formatter
        self.state = state

    def _append(self, target_dictionary, name, dt):
        target_dictionary[name] = Attachment(name, dt, self)

    def parameter(self, name, dt):
        self._append(self.inputs, name, dt)
        return self
    
    def output(self, name, dt):
        self._append(self.outputs, name, dt)
        return self

    def send(self, output_name, receiving_node, receiving_name):
        if output_name not in self.outputs:
            raise TypeError(f"output attachment {output_name} does not exist")
        if receiving_name not in receiving_node.inputs:
            raise TypeError(f"input attachment {receiving_name} does not exist")
        if self.outputs[output_name].data_type != receiving_node.inputs[receiving_name].data_type:
            raise TypeError(f"output data type {self.outputs[output_name].data_type} does not match "
                f"input data type {receiving_node.inputs[receiving_name].data_type}")
        if len(receiving_node.inputs[receiving_name].attachments) > 0:
            raise ValueError(f"receiving node already has attachment")

        self.outputs[output_name].add_attachment(receiving_node.inputs[receiving_name])
        receiving_node.inputs[receiving_name].add_attachment(self.outputs[output_name])




# FORMATTERS
#  Formatters take a dictionary of inputs matching those of their node types.
#  The inputs are variable names containing the results of the input attachments ("__temp01", etc.)
#  We return a JS expression that can be bound to a variable for each of the outputs.

def f_literal(n, inputs):
    return { "result": str(n.state["value"]) }

def f_binary_ss(n, inputs):
    left = inputs["left"]
    right = inputs["right"]
    return { "result": f"{left} {n.state['operation']} {right}" }

def f_binary_vv(n, inputs):
    left = map(lambda i: f"{inputs['left']}[{i}]", range(n.inputs["left"].data_type.arity()))
    right = map(lambda i: f"{inputs['right']}[{i}]", range(n.inputs["right"].data_type.arity()))
    paired = map(lambda x: f"({x[0]}{n.state['operation']}{x[1]})", zip(left, right))
    return { "result": f"[{','.join(paired)}]" }

def f_binary_sv(n, inputs):
    left = inputs["left"]
    right = list(map(lambda i: f"{inputs['right']}[{i}]", range(n.inputs["right"].data_type.arity())))
    paired = list(map(lambda x: f"{left}{n.state['operation']}{x}", right))
    return { "result": f"[{','.join(paired)}]" }

def f_reflow(n, inputs):
    pass



# NODE CONSTRUCTORS

def n_float(value):
    return Node(f_literal, {"value": value}).output("result", FLOAT)

def n_integer(value):
    return Node(f_literal, {"value": value}).output("result", INTEGER)

def n_identifier(name, data_type):
    return Node(f_literal, {"value": name}).output("result", data_type)

def n_binary(op, dt1, dt2):
    if (isinstance(dt1, FloatType) and isinstance(dt2, FloatType)) \
        or (isinstance(dt1, IntegerType) and isinstance(dt2, IntegerType)):
            prim = dt1
            return Node(f_binary_ss, {"operation": op}) \
                .parameter("left", prim).parameter("right", prim).output("result", prim)
    
    if isinstance(dt1, VectorType) and isinstance(dt2, VectorType):
        if dt1.arity() != dt2.arity():
            raise "vector types have differing arities"
        return Node(f_binary_vv, {"operation": op}) \
            .parameter("left", dt1).parameter("right", dt2).output("result", dt1)

    if isinstance(dt1, VectorType) and isinstance(dt2, FloatType):
        return Node(f_binary_sv, {"operation": op}) \
            .parameter("left", dt2).parameter("right", dt1).output("result", dt1)

    if isinstance(dt1, FloatType) and isinstance(dt2, VectorType):
        return Node(f_binary_sv, {"operation": op}) \
            .parameter("left", dt1).parameter("right", dt2).output("result", dt2)
    
    raise ValueError(f"binary operator {op} not applicable to types {dt1}, {dt2}")

def n_reflow(in_types, out_types, indices=None):
    in_count = 0
    primitive = None
    mapping = []

    for k, t in enumerate(in_types):
        if isinstance(t, VoidType) or isinstance(t, ArrayType):
            raise TypeError(f"cannot reflow {t}; invalid type")

        arity = t.arity()
        in_count += arity
        for i in range(arity):
            mapping.append((k, i))

        if primitive is None:
            primitive = t.primitive_type()
        elif primitive != t.primitive_type():
            raise TypeError(f"incompatible primitive types {primitive} and {t.primitive_type()}, both on input")

    if in_count <= 1:
        raise ValueError(f"cannot reflow {in_types}; the collective arity is {in_count}")

    if indices is None:
        indices = list(range(in_count))

    out_count = 0
    for t in out_types:
        if isinstance(t, VoidType) or isinstance(t, ArrayType):
            raise TypeError(f"cannot reflow {t}; invalid type")
        if primitive != t.primitive_type():
            raise TypeError(f"incompatible primitive types {primitive} on input, {t.primitive_type()} on output")
        out_count += t.arity()

    if out_count != in_count:
        raise TypeError(f"reflow from {in_count} to {out_count} arity is impossible")

    node = Node(f_reflow, {"mapping": mapping})
    for i in range(in_count):
        node.parameter(f"input_{i}", in_types[i])
    for i in range(out_count):
        node.output(f"output_{i}", out_types[i])

    return node



# OUTPUT

class CodeGenerator:
    def __init__(self, node, terminal_names=None):
        self.leaves = deque()
        self.in_degree = dict()
        self.enumerate_nodes(node)
        print(self.leaves)
        print(self.in_degree)

        self.processing_order = []
        self.topological_sort()
        print(self.processing_order)

        self.lines = []
        self.output_names = dict()
        self.build(node, terminal_names)
        
        self.terminals = self.output_names[node]

    def enumerate_nodes(self, node):
        if node in self.in_degree:
            raise ValueError("found cycle in expression DAG")
        
        self.in_degree[node] = len(node.inputs)
        if len(node.inputs) == 0:
            self.leaves.appendleft(node)
        
        for _, attachment in node.inputs.items():
            for previous in attachment.attachments:
                self.enumerate_nodes(previous.node)
    
    def generate_intermediate_name(self):
        global next_id
        result = f"_t{next_id}"
        next_id += 1
        return result

    def topological_sort(self):
        while len(self.leaves) > 0:
            node = self.leaves.popleft()
            self.processing_order.append(node)
            for attachment in node.outputs.values():
                for target_att in attachment.attachments:
                    target_node = target_att.node
                    self.in_degree[target_node] -= 1
                    if self.in_degree[target_node] == 0:
                        self.leaves.appendleft(target_node)

    def build(self, root, terminal_names):
        for node in self.processing_order:
            self.output_names[node] = dict()
            input_variables = dict()

            for input_name, attachment in node.inputs.items():
                if len(attachment.attachments) == 0:
                    raise ValueError(f"missing input attachment {input_name}")
                att = attachment.attachments[0]
                input_variables[input_name] = self.output_names[att.node][att.name]
            
            output_expressions = node.formatter(node, input_variables)
            for output_name, output_expression in output_expressions.items():
                if node is not root:
                    temp_name = self.generate_intermediate_name()
                else:
                    temp_name = terminal_names[output_name]
                self.output_names[node][output_name] = temp_name
                self.lines.append(f"const {temp_name} = {output_expression};")





# TEST

def test():
    a = n_float(10)
    b = n_identifier("f", FLOAT)
    c = n_binary("-", FLOAT, FLOAT)

    a.send("result", c, "left")
    b.send("result", c, "right")

    cg = CodeGenerator(c, {"result": "asdf"})
    pp.pp(cg.lines)
    pp.pp(cg.terminals)

    
    a = n_identifier("x", VectorType(FLOAT, 3))
    b = n_identifier("y", VectorType(FLOAT, 3))
    c = n_binary("-", VectorType(FLOAT, 3), VectorType(FLOAT, 3))

    d = n_float(10)
    e = n_binary("*", FLOAT, VectorType(FLOAT, 3))

    a.send("result", c, "left")
    b.send("result", c, "right")
    d.send("result", e, "left")
    c.send("result", e, "right")

    cg = CodeGenerator(e, {"result": "asdf"})
    pp.pp(cg.lines)
    pp.pp(cg.terminals)
    
test()