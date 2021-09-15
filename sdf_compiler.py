import functools
from lark import Lark
from os import listdir
from os.path import isfile, join


def read_file(filename):
    with open(filename, "r") as f:
        content = f.read()
    return content

def make_parser():
    grammar = read_file("glsl_modified_grammar.lark")
    return Lark(grammar, start="top")

def list_files(directory):
    return [join(directory, f) for f in listdir(directory) if isfile(join(directory, f))]

parser = make_parser()
for level in list_files("./levels"):
    text = read_file(level)
    tree = parser.parse(text)
    print(tree.pretty())