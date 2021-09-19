from dataclasses import dataclass
from typing import Annotated, Any, Dict

@dataclass
class VoidType:
    def arity(self): return 0

@dataclass
class BooleanType:
    def arity(self): return 1

@dataclass
class FloatType:
    def arity(self): return 1

@dataclass
class IntegerType:
    def arity(self): return 1

@dataclass
class ArrayType:
    primitive: Any
    size: int
    def arity(self): return self.size

@dataclass
class VectorType:
    primitive: Any
    size: int
    def arity(self): return self.size

@dataclass
class MatrixType:
    size: int
    def arity(self): return self.size * self.size


REWRITE_TYPES = {
    "void": VoidType(),
    "float": FloatType(),
    "int": IntegerType(),
    "vec2": VectorType(FloatType(), 2),
    "vec3": VectorType(FloatType(), 3),
    "vec4": VectorType(FloatType(), 4),
    "mat3": MatrixType(3),
    "mat4": MatrixType(4)
}

DISTRIBUTE = 0
ACCUMULATE = 1
VEC3_VEC3 = 2
VEC_VEC_MAT = 3
MAT_MAT = 4

REWRITE_CALLS = {
    "radians": ["RT.radians", DISTRIBUTE],
    "degrees": ["RT.degrees", DISTRIBUTE],
    "sin": ["Math.sin", DISTRIBUTE],
    "cos": ["Math.cos", DISTRIBUTE],
    "tan": ["Math.tan", DISTRIBUTE],
    "acos": ["Math.acos", DISTRIBUTE],
    "asin": ["Math.asin", DISTRIBUTE],
    "atan": ["RT.atan", DISTRIBUTE],
    "sinh": ["Math.sinh", DISTRIBUTE],
    "cosh": ["Math.cosh", DISTRIBUTE],
    "tanh": ["Math.tanh", DISTRIBUTE],
    "pow": ["Math.pow", DISTRIBUTE],
    "exp": ["Math.exp", DISTRIBUTE],
    "log": ["Math.log", DISTRIBUTE],
    "exp2": ["RT.exp2", DISTRIBUTE],
    "log2": ["Math.log2", DISTRIBUTE],
    "sqrt": ["Math.sqrt", DISTRIBUTE],
    "inversesqrt": ["RT.inversesqrt", DISTRIBUTE],
    "abs": ["Math.abs", DISTRIBUTE],
    "sign": ["Math.sign", DISTRIBUTE],
    "floor": ["Math.floor", DISTRIBUTE],
    "trunc": ["RT.trunc", DISTRIBUTE],
    "round": ["RT.round", DISTRIBUTE],
    "roundEven": ["RT.roundEven", DISTRIBUTE],
    "ceil": ["Math.ceil", DISTRIBUTE],
    "fract": ["RT.fract", DISTRIBUTE],
    "mod": ["RT.mod", DISTRIBUTE],
    "min": ["Math.min", DISTRIBUTE],
    "max": ["Math.max", DISTRIBUTE],
    "clamp": ["RT.clamp", DISTRIBUTE],
    "mix": ["RT.mix", DISTRIBUTE],
    "step": ["RT.step", DISTRIBUTE],
    "smoothstep": ["RT.smoothstep", DISTRIBUTE],

    "length": ["RT.length", ACCUMULATE],
    "distance": ["RT.length", ACCUMULATE],
    "dot": ["RT.dot", ACCUMULATE],
    "cross": ["RT.cross", VEC3_VEC3],
    "normalize": ["RT.normalize", DISTRIBUTE],
    "outerProduct": ["RT.outerProduct", VEC_VEC_MAT],
    "transpose": ["RT.transpose", MAT_MAT],
    "determinant": ["RT.determinant", ACCUMULATE],
    "inverse": ["RT.inverse", MAT_MAT]
}
