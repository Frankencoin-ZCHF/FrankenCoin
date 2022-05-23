# Calculate VaR for Basel iii approach
# 

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def roll_window(r : np.array, len : int) -> np.array:
    r0 = np.cumsum(r)
    r_shift = np.roll(r0, len)
    r_shift[0:len] = 0
    r_len = r0 - r_shift
    r_len = r_len[len-1:r_len.shape[0]]
    return r_len

def test_roll_window():
    r = np.array([0.1, 0.1, 0.2, 0.2, 0.4, 0.6])
    rd = roll_window(r, 2)
    print(rd)

if __name__ == "__main__":

    TauIn = 1440#60
    DF = pd.read_pickle("./Risk/XBTCHF_"+str(TauIn)+"_Processed_v3.pkl")
    r_raw = DF["logRet"].to_numpy()
    # calculate rolling window 5 day returns
    num_days = 5
    r = roll_window(r_raw, num_days)

    r99 = np.quantile(r, 0.01)
    k = 0.02
    VaR = (1-np.exp(r99)) + k 
    plt.hist(r,50, density=True,histtype='stepfilled', alpha=0.5, label='data')
    print(f"VaR {num_days}-day: return = {100*r99:.2f}%, VaR={100*VaR:.2f}%")
    


    h=0.1
    E = VaR*(1+h)-h
    RWA = E*1.5

    print(f"E={100*E:.2f}% RWA={RWA*100:.2f}%")
    plt.show()