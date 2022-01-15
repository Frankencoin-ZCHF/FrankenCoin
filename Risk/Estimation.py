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

def get_block_bootstrap_mtrx(rvec, tau, N):
    #Construct matrix of block bootstrapped log-returns. blocks of size tau
    #N columns, rvec rows
    Rtau = np.zeros((N,))
    L = rvec.shape[0]
    for k in range(N):
        pivot = random.randrange(0, L)
        idx = np.mod(pivot + np.arange(0, tau), L)
        Rtau[k] = np.sum(rvec[idx])
    return Rtau


DF = pd.read_pickle("./XBTCHF_60_Processed.pkl")

r = DF["logRet"].to_numpy()
# parameters
h = 0.10 # required maintenance margin and ultimately the haircut
k = 0.02 # challenger fee
tau = 24 # 24 hours of duration for liquidation

num_rounds = 100
Lvec = np.zeros((num_rounds,))
N = 200
for j in range(num_rounds):
    # bootstrap returns
    #Rtau = get_bootstrap_mtrx(r, tau, N)
    Rtau = get_block_bootstrap_mtrx(r, tau, N)
    K = Rtau.shape[0]
    # monte-carlo integration
    Lvec[j] = -np.sum(np.minimum((1+h)*np.exp(Rtau)-(1+k), h-k))/K

print("Summary")
S = stats.describe(Lvec)
print(stats.describe(Lvec))
print("std dev = ", np.sqrt(S.variance))
