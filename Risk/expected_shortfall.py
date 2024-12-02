import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats
from scipy.stats import genpareto
import statsmodels.api as sm
import statsmodels.graphics.gofplots as gofplots

def loss_dist(r, r_max, hDash):
    thresh = np.log(1+h) - np.log(1+hDash)
    D = r_max < thresh
    L = -(D * ((1+hDash)*np.exp(r)-(1+rateK)))
    return L

def get_tail_loss(r, r_max, hDash, uThresh):
    thresh = np.log(1+h) - np.log(1+hDash)
    D = r_max < thresh
    L = -(D * ((1+hDash)*np.exp(r)-(1+rateK)))
    return L[L>=uThresh]

def empirical_mean_excess_function(L, u):
    """
    Calculate empirical mean excess function
    L : vector of losses
    u : threshold
    return empirical excess mean
    """
    emp_ex = np.sum(np.maximum(L-u, 0)) / np.sum(L>u)
    return emp_ex

def plot_eme(L, u_start):
    u_end = np.quantile(L, 1-0.5/100)
    Lsub = L[(L>=u_start) & (L<=u_end)]
    num_u = Lsub.shape[0]
    emx = np.zeros(num_u)
    for t in range(num_u):
        emx[t] = empirical_mean_excess_function(L, Lsub[t])
    plt.figure
    plt.plot(Lsub, emx, '+')
    plt.xlabel("Loss, h'="+str(hDash))
    plt.ylabel("Empirical mean excess function")
    plt.grid()
    plt.show()
    
def estimate_tail_loss(u_thresh):
    # tail loss
    X = get_tail_loss(r, r_max, hDash, u_thresh)
    print(f"Number of observations for u={u_thresh:.2f}: {X.shape[0]:.0f}")
    plt.hist(X,50, density=True,histtype='stepfilled', alpha=0.5, label='data')
    plt.xlabel("loss, h'="+str(hDash))
    #plt.plot(q, 0, 'r*')
    plt.grid()
    plt.xticks(np.arange(-0.1, 0.5, step=0.025))


    [c, loc, scale] = genpareto.fit(X)
    print("c={:.4f} l={:.4f} s={:.4f}".format(c,loc,scale))
    #x_rand = genpareto.rvs(c, loc, scale, 5000)
    #plt.hist(x_rand,100, density=True,histtype='stepfilled', alpha=0.5, label='random')

    x_plt = np.arange(np.min(X), np.max(X), 0.005)
    y = genpareto.pdf(x_plt, c, loc, scale)
    plt.plot(x_plt, y, 'r-')
    plt.show()
    
    gofplots.qqplot(X, genpareto, distargs=(c,), loc=loc, scale=scale, line='s')
    plt.grid()
    plt.show()
    es_quantile = 0.95
    Q = es_quantile
    #https://en.wikipedia.org/wiki/Expected_shortfall
    ES1 = loc + scale * ( (1-Q)**(-c) / (1-c) + ( (1-Q)**(-c) - 1 ) / c )
    ES_emp = np.mean(L[L>np.quantile(L, es_quantile)])
    print("ES empirical = {:.4f} ES pareto = {:.4f}".format(ES_emp, ES1))
    print("Max loss = ", np.max(X))

def plot_max_loss_given_h(r, r_max):
    hDashVec = np.arange(0.99, 1.1, 0.01)-1
    lmaxminmed= np.zeros((hDashVec.shape[0],3))
    cnt = 0
    plt.figure()
    for hD in hDashVec:
        L = loss_dist(r, r_max, hD)
        print(f"1%-quantile for h'={hD:.2f} is {100*np.quantile(L,0.99):.2f}%")
        plt.boxplot(L, positions=[100*(1+hD)])
        cnt = cnt + 1
    plt.grid()
    plt.xlabel("(1+h'), %")
    plt.ylabel("Loss")
    lbls = [ "{:0.0f}".format(x) for x in 100*(1+hDashVec) ]
    plt.xticks(ticks=100*(1+hDashVec), labels = lbls)
    plt.show()
    

def construct_overlapping_returns(r_in, TauIn_min, tau_min):
    num_roll = int(np.round(tau_min/TauIn_min))
    R = np.zeros((r_in.shape[0], num_roll))
    for k in range(num_roll):
        R[:,k]=np.roll(r_in, -k)
    R = R[0:R.shape[0]-2,:]
    return np.sum(R, 1)

# 1) data
TauIn = 1440#60
DF = pd.read_pickle("./Risk/XBTEUR_"+str(TauIn)+"_Processed_v3.pkl")
r_in = DF["logRet"].to_numpy()
stats.describe(r_in)
r_in_max = DF["maxRet"].to_numpy()
# 2) parameters
h = 0.10 # required maintenance margin and ultimately the haircut
rateK = 0.02 # challenger fee
tau_min = 1 * 24 * 60# 1 * 24 hours of duration for liquidation
r = construct_overlapping_returns(r_in, TauIn, tau_min)
r_max = construct_overlapping_returns(r_in_max, TauIn, tau_min)

plot_max_loss_given_h(r, r_max)

# plain loss distribution
hDash = 0.05
L = loss_dist(r, r_max, hDash)
print(stats.describe(L))

# EME
plot_eme(L, u_start=0)

# GPD
estimate_tail_loss(u_thresh=0.05)
