from scipy.stats import norm, t
import numpy as np
import scipy.integrate as integrate


tau = 3
sig = 0.05*np.sqrt(tau)
c = 0.01
h = 0.10
k = np.log((1+c)/(1+h))

def lossfunc(r):
    return (np.exp(r) * (1+h) - (1+c)) * norm.pdf(r, 0, sig)
def lossfuncT(r):
    df = 4
    return (np.exp(r) * (1+h) - (1+c)) * t.pdf(r, df, 0, sig)

resultNorm = integrate.quad(lossfunc, -np.inf, k)
resultT = integrate.quad(lossfuncT, -np.inf, k)
print("integration Norm = ", resultNorm)
print("integration T = ", resultT)
premT = -resultT[0]
print("premium t-dist= ", premT * 100, "%")
premNorm = -resultNorm[0]
print("premium norm-dist = ", premNorm * 100, "%")