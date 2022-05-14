# Results for Liquid Collateral Minting Fees
# 

import datetime
from math import dist
#from turtle import color
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
    # Construct matrix of bootstrapped log-returns. 
    # Period tau
    # N columns, rvec rows
    R = np.zeros((r.shape[0], tau))
    Rtau = np.zeros((r.shape[0], N))
    for k in range(N):
        for t in range(tau):
            R[:,t] = rvec
            np.random.shuffle(R[:,t])
        Rtau[:,k] = np.sum(R, 1)
    return Rtau.flatten()

def get_block_bootstrap_mtrx(rvec, tau, TauIn, N):
    # Construct matrix of block bootstrapped log-returns. time-length tau
    # The function will take tau/TauIn consecutive samples to construct one
    # observation
    # N columns, rvec rows
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
    # for a given probability of liquidation, determine h'
    # liquidation if (1+h')e^r <= 1+h
    # <=> (1+h)e^(-r) - 1 = h'
    global h
    V = (1+h)*np.exp(-Rtau) - 1
    HDash = np.quantile(V, 1 - alpha, axis=1)
    # check quantile: sum( (1+HDash[1])*np.exp(Rtau[1,:])-1 > h)/Rtau.shape[1] 
    return HDash

def estimate_alpha_from_hDash(hDash, Rtau):
    # for a given h', determine the probability of liquidation
    # returns mean and standard deviation from bootstrap samples
    global h
    thresh = np.log(1+h) - np.log(1+hDash)
    prob_liquidation = np.mean(Rtau <= thresh, 1)
    s = np.std(prob_liquidation)/np.sqrt(Rtau.shape[0])
    mu = np.mean(prob_liquidation)
    # check quantile: sum( (1+HDash[1])*np.exp(Rtau[1,:])-1 > h)/Rtau.shape[1] 
    return [mu, s]

def estimate_ES(ESlvl, r, hDash):
    # empirical estimation of Expected Shortfall at quantile ESlvl
    thresh = np.quantile(r, ESlvl)
    num_obs = np.sum(r<thresh)
    PnLCondvec = np.sum((r<thresh) * ((1+hDash)*np.exp(r)-(1+rateK)))/num_obs    
    return -PnLCondvec

def calc_pnl(hDash, Rtau, RtauMax):
    global h
    thresh = np.log(1+h) - np.log(1+hDash)
    #Eq.(21) D 
    D = (RtauMax<thresh)
    #Eq.(24) E[P|h']
    PnLvec = np.sum(D * ((1+hDash)*np.exp(Rtau)-(1+rateK)), 1)/K  
    B = Rtau.shape[0]  
    # check for threshold: ((1+hDash)*np.exp(Rtau)<1+h) == (Rtau<thresh)
    s = np.sqrt(np.var(PnLvec)/B)
    mu = np.mean(PnLvec)
    return [mu, s]

if __name__ == "__main__":
    # candle time for the data (minutes)
    TauIn = 1440#60

    DF = pd.read_pickle("./Risk/XBTCHF_"+str(TauIn)+"_Processed_v3.pkl")

    r = DF["logRet"].to_numpy()
    r_max = DF["maxRet"].to_numpy()
    # parameters
    h = 0.10 # required maintenance margin and ultimately the haircut
    rateK = 0.02 # challenger fee
    tau = 24 # duration for liquidation in hours. 24 hours is used in main part of paper

    B = 5_000#10_000
    # bootstrap returns
    #Rtau = get_bootstrap_mtrx(r, tau, N)
    Rtau = get_block_bootstrap_mtrx(r, tau, TauIn, B)
    RtauMax = get_block_bootstrap_mtrx(r_max, tau, TauIn, B)
    K = Rtau.shape[1]
    # monte-carlo integration
    #Lvec[j] = -np.sum(np.minimum((1+h)*np.exp(Rtau)-(1+k), h-k))/K

    alpha = 0.9
    # hDashVec = estimate_hDash(alpha, Rtau)
    # hDash  = np.mean(hDashVec)
    # hDashVar = np.var(hDashVec)
    # for hD in np.arange(-0.05, 0.15, 0.01):
    #     thresh = np.log(1+h) - np.log(1+hD)
    #     #no_early_liq = (RtauMax<thresh) #\hat{D}_{\tau}^{(j,n)}
    #     PnLvec = np.sum((RtauMax<thresh) * ((1+hD)*np.exp(Rtau)-(1+rateK)), 1)/K
    #     print("h\'={:.2f} : P={:.2f}%".format(hD, np.mean(PnLvec)*100))

    # estimate probability of liquidation, given h-dash

    # theoretical probability of liquidation assuming a normal distribution
    mu_r = np.mean(r)
    sig_r = np.std(r)
    def eval_prob_theo(hDash): return norm.cdf((np.log(1+h) - np.log(1+hDash) - mu_r ) / sig_r)

    T = norm.ppf(0.99)
    hDashVec = np.arange(-0.05, 0.25, 0.005);
    Prob = np.zeros((hDashVec.shape[0],2))
    Prob_noearly = np.zeros((hDashVec.shape[0],2)) #no early end
    Prob_theo = np.zeros((hDashVec.shape[0],1))
    pnl_vec = np.zeros((hDashVec.shape[0],2))
    t=0
    for hD in hDashVec:
        [m,s] = estimate_alpha_from_hDash(hD, RtauMax)
        Prob[t,:] = [m*100, T*s*100]
        [m,s] = estimate_alpha_from_hDash(hD, Rtau)
        Prob_noearly[t,:] = [m*100, T*s*100]
        Prob_theo[t] = eval_prob_theo(hD) * 100.0
        [m_pnl,s_pnl] = calc_pnl(hD, Rtau, RtauMax);
        pnl_vec[t,:] = [m_pnl*100, T*s_pnl*100]
        print(f"h'={hD:.2f} alpha={m*100:.2f} +/- {T*s*100:.2f} PnL={m_pnl*100:.2f} +/- {T*s_pnl*100:.2f}");
        t = t + 1

    # plot probability of liquidation given h'
    plt.figure
    plot_ticks = np.arange(-0.04, 0.25, 0.02)
    lbls = [ "{:0.0f}".format(x) for x in 100*(1+plot_ticks) ]
    plt.plot(100*(1+hDashVec), Prob[:,0], 'k-', label='empirical')
    plt.plot(100*(1+hDashVec), Prob_noearly[:,0], '--', color="cadetblue", label='empirical: not averted early')
    plt.plot(100*(1+hDashVec), Prob_theo[:,0], 'b:', label='normal: not averted early')
    plt.xticks(ticks=100*(1+plot_ticks), labels = lbls)
    plt.yticks(ticks=np.arange(0,101,10), labels = [ "{:0.0f}".format(x) for x in np.arange(0,101,10) ])
    plt.xlabel("(1+h'), %")
    plt.ylabel("Probability of liquidation, %")
    plt.axvline(x=110, color='r', linestyle='--', label='(1+h), %')
    plt.legend()
    plt.grid()
    plt.show()

    # plot PnL given h'
    plt.figure
    plot_ticks = np.arange(-0.04, 0.25, 0.02)
    lbls = [ "{:0.0f}".format(x) for x in 100*(1+plot_ticks) ]
    plt.plot(100*(1+hDashVec), pnl_vec[:,0], '-', label='pnl')
    plt.xticks(ticks=100*(1+plot_ticks), labels = lbls)
    plt.yticks(ticks=np.arange(-6,3.5,1), labels = [ "{:0.2f}".format(x) for x in np.arange(-6,3.5,1) ])
    plt.xlabel("(1+h'), %")
    plt.ylabel("E[P|h'], %")
    plt.axvline(x=110, color='r', linestyle='--', label='(1+h), %')
    plt.legend()
    plt.grid()
    plt.show()


    # empirical ES. This is properly dealt with in
    # expected_shortfall.py
    #ES = estimate_ES(0.01, r, hDash)
    #ESmean = np.mean(ES)
    #ESstd = np.sqrt(np.var(ES)/Rtau.shape[0])
    #alpha_conf = 0.01
    #T = tdist.ppf(1-alpha_conf/2, B-1)
    #print('Empirical ES={:.2f} +/- {:.2f}'.format(ESmean, ESstd*T))

    """ hDash = 0.05
    thresh = np.log(1+h) - np.log(1+hDash)
    PnLvec = np.sum((Rtau<thresh) * ((1+hDash)*np.exp(Rtau)-(1+rateK)), 1)/K    
    # check for threshold: ((1+hDash)*np.exp(Rtau)<1+h) == (Rtau<thresh)
    print("Summary")
    S = stats.describe(PnLvec)
    print(stats.describe(PnLvec))
    s = np.sqrt(S.variance/B)
    print("std dev = ", s)
    print("mean    = ", S.mean)
    txt = 'alpha = {:.2f}; h\'={:.2f} +/-{:.2f} ; L: {:.2f}% +/- {:.2f}%'

    sH = np.sqrt(hDashVar/B)

    print(txt.format(alpha, hDash, T*sH, 100*S.mean, T*s)) """
