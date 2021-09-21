import functools
from dataclasses import dataclass
from os import X_OK
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
    def __init__(self, formatter, state=None, substitutable=False):
        self.inputs = dict()
        self.outputs = dict()
        self.formatter = formatter
        self.state = state
        self.substitutable = substitutable

    def _append(self, target_dictionary, name, dt):
        target_dictionary[name] = Attachment(name, dt, self)

    def parameter(self, name, dt):
        self._append(self.inputs, name, dt)
        return self
    
    def output(self, name, dt):
        self._append(self.outputs, name, dt)
        return self

    def send(self, output_name, receiving_node, receiving_name):
        if output_name is None:
            output_name = self.get_single_output().name
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
   
    def get_single_output(self):
        if len(self.outputs) != 1:
            raise ValueError("context required exactly 1 output")
        for _, v in self.outputs.items():
            return v




# FORMATTERS
#  Formatters take a dictionary of inputs matching those of their node types.
#  The inputs are variable names containing the results of the input attachments ("__temp01", etc.)
#  We return a JS expression that can be bound to a variable for each of the outputs.

def f_literal(n, inputs):
    return { "result": str(n.state["value"]) }

def f_unary_s(n, inputs):
    return { "result": n.state["combiner"](inputs["value"]) }

def f_unary_v(n, inputs):
    values = map(lambda i: n.state["combiner"](f"{inputs['value']}[{i}]"), \
        range(n.inputs["value"].data_type.arity()))

    return { "result": f"[{','.join(values)}]" }

def f_binary_ss(n, inputs):
    left = inputs["left"]
    right = inputs["right"]
    return { "result": n.state["combiner"](left, right) }

def f_binary_vv(n, inputs):
    left = map(lambda i: f"{inputs['left']}[{i}]", range(n.inputs["left"].data_type.arity()))
    right = map(lambda i: f"{inputs['right']}[{i}]", range(n.inputs["right"].data_type.arity()))
    paired = map(lambda x: n.state["combiner"](x[0], x[1]), zip(left, right))
    return { "result": f"[{','.join(paired)}]" }

def f_binary_sv(n, inputs):
    left = inputs["left"]
    right = list(map(lambda i: f"{inputs['right']}[{i}]", range(n.inputs["right"].data_type.arity())))
    paired = list(map(lambda x: n.state["combiner"](left, x), right))
    return { "result": f"[{','.join(paired)}]" }

def f_binary_vs(n, inputs):
    left = list(map(lambda i: f"{inputs['left']}[{i}]", range(n.inputs["left"].data_type.arity())))
    right = inputs["right"]
    paired = list(map(lambda x: n.state["combiner"](x, right), left))
    return { "result": f"[{','.join(paired)}]" }

def f_branch(n, inputs):
    return { "result": f"{inputs['condition']} ? {inputs['if_true']} : {inputs['if_false']}" }

def f_call(n, inputs):
    parameters = []
    for ii in range(len(n.inputs)):
        parameters.append(
            inputs[n.state["input_names"][ii] if n.state["input_names"] is not None else f"input_{ii}"])
    
    return { "result": f"{n.state['function_name']}({', '.join(parameters)})" }

def f_call_distribute(n, inputs):
    calls = []
    for i in range(n.outputs["result"].data_type.arity()):
        arguments = []
        for k in range(len(n.inputs)):
            key = f"input_{k}"
            dt = n.inputs[key].data_type
            if dt.arity() == 1:
                arguments.append(inputs[key])
            else:
                arguments.append(f"{inputs[key]}[{i}]")
        calls.append(f'{n.state["function_name"]}({",".join(arguments)})')

    if len(calls) > 1:
        return { "result": f"[{', '.join(calls)}]" }
    else:
        return { "result": calls[0] }

def f_reflow(n, inputs):
    mapping = []
    for ii in range(len(n.inputs)):
        input = n.inputs[f"input_{ii}"]
        if isinstance(input.data_type, FloatType) or isinstance(input.data_type, IntegerType):
            mapping.append(inputs[f"input_{ii}"])
        else:
            for a in range(input.data_type.arity()):
                mapping.append(inputs[f"input_{ii}"] + f"[{a}]")

    outputs = dict()

    ii = 0
    for oi in range(len(n.outputs)):
        output = n.outputs[f"output_{oi}"]

        if isinstance(output.data_type, FloatType) or isinstance(output.data_type, IntegerType):
            outputs[output.name] = mapping[n.state["indices"][ii]]
            ii += 1
        else:
            items = []
            for a in range(output.data_type.arity()):
                items.append(mapping[n.state["indices"][ii]])
                ii += 1
            outputs[output.name] = f"[{','.join(items)}]"
    
    return outputs



# NODE CONSTRUCTORS

def n_float(value):
    return Node(f_literal, {"value": value}, True).output("result", FLOAT)

def n_integer(value):
    return Node(f_literal, {"value": value}, True).output("result", INTEGER)

def n_identifier(name, data_type):
    return Node(f_literal, {"value": name}, True).output("result", data_type)

def n_unary(combiner, dt_in, dt_out):
    formatter = f_unary_s if dt_in.arity() == 1 else f_unary_v
    return Node(formatter, {"combiner": combiner}) \
        .parameter("value", dt_in).output("result", dt_out)

def n_binary(combiner, dt1, dt2, dt_out=None):
    if (isinstance(dt1, FloatType) and isinstance(dt2, FloatType)) \
        or (isinstance(dt1, IntegerType) and isinstance(dt2, IntegerType)) \
        or (isinstance(dt1, BooleanType) and isinstance(dt2, BooleanType)):
            prim = dt1
            return Node(f_binary_ss, {"combiner": combiner}) \
                .parameter("left", prim).parameter("right", prim) \
                .output("result", prim if dt_out is None else dt_out)
    
    if isinstance(dt1, VectorType) and isinstance(dt2, VectorType):
        if dt1.arity() != dt2.arity():
            raise "vector types have differing arities"
        return Node(f_binary_vv, {"combiner": combiner}) \
            .parameter("left", dt1).parameter("right", dt2) \
            .output("result", dt1 if dt_out is None else dt_out)

    if (isinstance(dt1, VectorType) or isinstance(dt1, MatrixType)) and isinstance(dt2, FloatType):
        return Node(f_binary_vs, {"combiner": combiner}) \
            .parameter("left", dt1).parameter("right", dt2) \
            .output("result", dt1 if dt_out is None else dt_out)

    if isinstance(dt1, FloatType) and (isinstance(dt2, VectorType) or isinstance(dt2, MatrixType)):
        return Node(f_binary_sv, {"combiner": combiner}) \
            .parameter("left", dt1).parameter("right", dt2) \
            .output("result", dt2 if dt_out is None else dt_out)
    
    if isinstance(dt1, MatrixType) and isinstance(dt2, VectorType):
        if dt1.arity() != dt2.arity() * dt2.arity():
            raise TypeError("matrix multiplication of incompatible types")
        return n_call("RT.matmul", [dt1, dt2], dt2, f_call, input_names=["left", "right"])

    raise ValueError(f"binary operator not applicable to types {dt1}, {dt2}")

def n_branch(dt):
    return Node(f_branch, {}) \
        .parameter("condition", BOOLEAN).parameter("if_true", dt).parameter("if_false", dt) \
        .output("result", dt)

def n_call(function_name, in_types, out_type, formatter=f_call, input_names=None):
    node = Node(formatter, {
        "function_name": function_name,
        "input_names": input_names
    })

    for i in range(len(in_types)):
        if input_names is None:
            node.parameter(f"input_{i}", in_types[i])
        else:
            node.parameter(input_names[i], in_types[i])

    node.output(f"result", out_type)

    return node

def n_reflow(in_types, out_types, indices=None):
    in_count = 0
    primitive = None

    for k, t in enumerate(in_types):
        if isinstance(t, VoidType) or isinstance(t, ArrayType):
            raise TypeError(f"cannot reflow {t}; invalid type")

        arity = t.arity()
        in_count += arity

        if primitive is None:
            primitive = t.primitive_type()
        elif primitive != t.primitive_type():
            raise TypeError(f"incompatible primitive types {primitive} and {t.primitive_type()}, both on input")

    if in_count <= 0:
        raise ValueError(f"cannot reflow {in_types}; the collective arity is {in_count}")

    if indices is None:
        indices = list(range(in_count))  # to do

    for index in indices:
        if index < 0 or index >= in_count:
            raise ValueError(f"reflow index {index} invalid for input of size {in_count}")

    out_count = 0
    for t in out_types:
        if isinstance(t, VoidType) or isinstance(t, ArrayType):
            raise TypeError(f"cannot reflow {t}; invalid type")
        if primitive != t.primitive_type():
            raise TypeError(f"incompatible primitive types {primitive} on input, {t.primitive_type()} on output")
        out_count += t.arity()

    if out_count != len(indices):
        raise TypeError(f"expected {len(indices)} arity, got {out_count}")

    inline = (len(in_types) == 1 and out_count == 1)

    node = Node(f_reflow, {"indices": indices}, inline)
    for i in range(len(in_types)):
        node.parameter(f"input_{i}", in_types[i])
    for i in range(len(out_types)):
        node.output(f"output_{i}", out_types[i])

    return node




# CODE GENERATION

class CodeGenerator:
    def __init__(self, node, terminal_names=None):
        self.leaves = deque()
        self.in_degree = dict()
        self.enumerate_nodes(node)

        self.processing_order = []
        self.topological_sort()

        self.lines = []
        self.output_names = dict()
        self.build(node, terminal_names)
        
        self.terminals = self.output_names[node]

    def get_single_output(self):
        if len(self.terminals) != 1:
            raise ValueError("context requires exactly 1 generator output")
        for _, v in self.terminals.items():
            return v

    def all_lines(self, indent=0):
        left = margin(indent)
        return "".join(map(lambda x: f"{left}{x}\n", self.lines))

    def enumerate_nodes(self, node):
        if node in self.in_degree:
            return
        
        self.in_degree[node] = len(node.inputs)
        if len(node.inputs) == 0:
            self.leaves.appendleft(node)
        
        for _, attachment in node.inputs.items():
            for previous in attachment.attachments:
                self.enumerate_nodes(previous.node)
    
    def generate_intermediate_name(self):
        global next_id
        result = f"t{next_id}_"
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

    def build(self, root, terminal_names=None):
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
                if node.substitutable:
                    self.output_names[node][output_name] = output_expression
                    continue

                if node is not root or terminal_names is None or output_name not in terminal_names:
                    temp_name = self.generate_intermediate_name()
                else:
                    temp_name = terminal_names[output_name]
                
                self.output_names[node][output_name] = temp_name
                self.lines.append(f"const {temp_name} = {output_expression};")





# TEST

def test():
    a = n_float(10)
    b = n_identifier("f", FLOAT)
    c = n_binary(lambda x, y: f"{x}-{y}", FLOAT, FLOAT)

    a.send("result", c, "left")
    b.send("result", c, "right")

    cg = CodeGenerator(c, {"result": "asdf"})
    pp.pp(cg.lines)
    pp.pp(cg.terminals)

    
    a = n_identifier("x", VectorType(FLOAT, 3))
    b = n_identifier("y", VectorType(FLOAT, 3))
    c = n_binary(lambda x, y: f"{x}-{y}", VectorType(FLOAT, 3), VectorType(FLOAT, 3))

    d = n_float(10)
    e = n_binary(lambda x, y: f"mod({x},{y})", FLOAT, VectorType(FLOAT, 3))

    a.send("result", c, "left")
    b.send("result", c, "right")
    d.send("result", e, "left")
    c.send("result", e, "right")

    cg = CodeGenerator(e, {"result": "asdf"})
    pp.pp(cg.lines)
    pp.pp(cg.terminals)
    
    d = n_identifier("d", VectorType(FLOAT, 3))
    a = n_call("RT.mod", [VectorType(FLOAT, 3), VectorType(FLOAT, 3)], VectorType(FLOAT, 3))
    b = n_identifier("y", VectorType(FLOAT, 2))
    c = n_float(5)

    f = n_reflow([VectorType(FLOAT, 3), VectorType(FLOAT, 2), FLOAT], [VectorType(FLOAT, 4), VectorType(FLOAT, 2)])
    d.send("result", a, "input_0")
    d.send("result", a, "input_1")
    a.send("result", f, "input_0")
    b.send("result", f, "input_1")
    c.send("result", f, "input_2")

    cg = CodeGenerator(f, {"output_0": "aa", "output_1": "bb"})
    pp.pp(cg.lines)
    pp.pp(cg.terminals)

