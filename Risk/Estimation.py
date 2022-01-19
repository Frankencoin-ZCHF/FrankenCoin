import datetime
from math import dist
import requests
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats
import statsmodels.api as sm
import data_roller
import random
from scipy.stats import norm
from scipy.stats import t as tdist


def get_bootstrap_mtrx(rvec, tau, N):
    #Construct matrix of bootstrapped log-returns. Period tau-hours,
    #N columns, rvec rows
    R = np.zeros((r.shape[0], tau))
    Rtau = np.zeros((r.shape[0], N))
    for k in range(N):
        for t in range(tau):
            R[:,t] = rvec
            np.random.shuffle(R[:,t])
        Rtau[:,k] = np.sum(R, 1)
    return Rtau.flatten()

def get_block_bootstrap_mtrx(rvec, tau, TauIn, N):
    #Construct matrix of block bootstrapped log-returns. time-length tau
    #N columns, rvec rows
    num_returns_for_Rtau = int(tau/TauIn*60)
    K = rvec.shape[0]
    Rtau = np.zeros((N, K))
    for j in range(N):
        # one bootstrap sample
        for k in range(K):
            pivot = random.randrange(0, K)
            idx = np.mod(pivot + np.arange(0, num_returns_for_Rtau), K)
            ret_tau = np.sum(rvec[idx])
            Rtau[j, k] = ret_tau
    return Rtau

def estimate_hDash(alpha, Rtau):
    V = (1+h)*np.exp(-Rtau) - 1
    HDash = np.quantile(V, 1 - alpha, axis=1)
    # check quantile: sum( (1+HDash[1])*np.exp(Rtau[1,:])-1 > h)/Rtau.shape[1] 
    return HDash

def estimate_ES(ESlvl, r, hDash):
    # empirical estimation of Expected Shortfall at quantile ESlvl
    thresh = np.quantile(r, ESlvl)
    num_obs = np.sum(r<thresh)
    LCondvec = -np.sum((r<thresh) * ((1+hDash)*np.exp(r)-(1+rateK)), 1)/num_obs    
    return LCondvec



TauIn = 1440#60
DF = pd.read_pickle("./Risk/XBTCHF_"+str(TauIn)+"_Processed.pkl")

r = DF["logRet"].to_numpy()
# parameters
h = 0.10 # required maintenance margin and ultimately the haircut
rateK = 0.02 # challenger fee
tau = 24 # 24 hours of duration for liquidation

B = 5000
# bootstrap returns
#Rtau = get_bootstrap_mtrx(r, tau, N)
Rtau = get_block_bootstrap_mtrx(r, tau, TauIn, B)
K = Rtau.shape[1]
# monte-carlo integration
#Lvec[j] = -np.sum(np.minimum((1+h)*np.exp(Rtau)-(1+k), h-k))/K

alpha = 0.9
hDashVec = estimate_hDash(alpha, Rtau)
hDash  = np.mean(hDashVec)
hDashVar = np.var(hDashVec)
for hD in np.arange(-0.05, 0.15, 0.01):
    thresh = np.log(1+h) - np.log(1+hD)
    Lvec = -np.sum((Rtau<thresh) * ((1+hD)*np.exp(Rtau)-(1+rateK)), 1)/K
    print("h\'={:.2f} : L={:.2f}%".format(hD, np.mean(Lvec)*100))


ES = estimate_ES(0.01, r, hDash)
ESmean = np.mean(ES)
ESstd = np.sqrt(np.var(ES)/Rtau.shape[0])
alpha_conf = 0.01
T = tdist.ppf(1-alpha_conf/2, B-1)
print('ES={:.2f} +/- {:.2f}'.format(ESmean, ESstd*T))

thresh = np.log(1+h) - np.log(1+hDash)
Lvec = -np.sum((Rtau<thresh) * ((1+hDash)*np.exp(Rtau)-(1+rateK)), 1)/K    
# check for threshold: ((1+hDash)*np.exp(Rtau)<1+h) == (Rtau<thresh)
print("Summary")
S = stats.describe(Lvec)
print(stats.describe(Lvec))
s = np.sqrt(S.variance/B)
print("std dev = ", s)
print("mean    = ", S.mean)
txt = 'alpha = {:.2f}; h\'={:.2f} +/-{:.2f} ; L: {:.2f}% +/- {:.2f}%'

sH = np.sqrt(hDashVar/B)

print(txt.format(alpha, hDash, T*sH, 100*S.mean, T*s))
