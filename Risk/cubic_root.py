import numpy as np


def mulD18(a, b):
    return a*b/1e18

def divD18(a, b):
    return a/b * 1e18

def pow3(x):
    return mulD18(x, mulD18(x, x));

def halleyD18(a):
    x0 = 1e18
    x = x0
    x_old = x0+1e18
    num_it = 0
    THRESH_DEC18 = 0.01 * 1e18
    cond = True
    while cond:
        x_old = x
        p3 = pow3(x)
        x = mulD18(x, divD18(p3 + 2 * a, 2 * p3 + a) )
        num_it = num_it + 1
        cond = x_old - x > THRESH_DEC18 \
            if x_old > x else x - x_old > THRESH_DEC18
    print("iterations = ", num_it)
    return x

def halley(a):
    x0 = 1
    x = x0
    x_old = x0+1
    num_it = 0
    while np.abs(x_old - x) > 0.01:
        x_old = x
        x = x * (x**3 + 2 * a ) / (2 * x**3 + a)
        num_it = num_it + 1
    print("iterations = ", num_it)
    return x


if __name__=="__main__":
    v = 0.3
    a_hat = halley(v)
    print(f"{a_hat:0.14f} -> error = {a_hat**3 - v:0.14f}")
    print(f"{v**(1/3):0.14f}")

    v18 = v * 1e18
    a_hatD18 = halleyD18(v18)
    print(f"{a_hatD18:1f}={a_hatD18/1e18:0.14f}")
    v18hat = mulD18(a_hatD18, mulD18(a_hatD18, a_hatD18))
    print(f"v18 = {v18hat/1e18:0.14f}")