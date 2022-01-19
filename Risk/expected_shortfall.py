import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats
from scipy.stats import genpareto


def loss_dist(r, hDash):
    thresh = np.log(1+h) - np.log(1+hDash)
    L = -((r<thresh) * ((1+hDash)*np.exp(r)-(1+rateK)))
    return L

def get_tail_loss(r, hDash, alpha):
    thresh = np.log(1+h) - np.log(1+hDash)
    L = -((r<thresh) * ((1+hDash)*np.exp(r)-(1+rateK)))
    q = np.quantile(L, alpha)
    return (q, L[L>=q])

# 1) data
TauIn = 1440#60
DF = pd.read_pickle("./Risk/XBTCHF_"+str(TauIn)+"_Processed.pkl")
r = DF["logRet"].to_numpy()
# 2) parameters
h = 0.10 # required maintenance margin and ultimately the haircut
rateK = 0.02 # challenger fee
tau = 24 # 24 hours of duration for liquidation

# plain loss distribution
loss_quantile = 0.9
hDash = 0.05
L = loss_dist(r, hDash)
# tail loss
(q, X) = get_tail_loss(r, hDash, loss_quantile)

plt.hist(X,50, density=True,histtype='stepfilled', alpha=0.5, label='data')
plt.xlabel("loss, h'="+str(0.05))
plt.plot(q, 0, 'r*')
plt.grid()
plt.xticks(np.arange(-0.1, 0.5, step=0.025))


[c, loc, scale] = genpareto.fit(X)
x_rand = genpareto.rvs(c, loc, scale, 1000)
#plt.hist(x_rand,100, density=True,histtype='stepfilled', alpha=0.5, label='random')

x_plt = np.arange(np.min(X), np.max(X), 0.005)
y = genpareto.pdf(x_plt, c, loc, scale)
plt.plot(x_plt, y, 'r-')
plt.show()

es_quantile = 0.95
Q = es_quantile#1-es_quantile
#https://en.wikipedia.org/wiki/Expected_shortfall
ES1 = loc + scale * ( (1-Q)**(-c) / (1-c) + ( (1-Q)**(-c) - 1 ) / c )
ES_emp = np.mean(L[L>np.quantile(L, es_quantile)])
print("ES empirical = {:.4f} ES pareto = {:.4f}".format(ES_emp, ES1))