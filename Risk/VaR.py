# Calculate VaR for Basel iii approach
# 

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

if __name__ == "__main__":
    TauIn = 1440#60
    DF = pd.read_pickle("./Risk/XBTCHF_"+str(TauIn)+"_Processed_v2.pkl")
    r = DF["logRet"].to_numpy()
    r99 = np.quantile(r, 0.01)
    VaR = 1-np.exp(r99)
    plt.hist(r,50, density=True,histtype='stepfilled', alpha=0.5, label='data')
    print(f"VaR 1-day: return = {100*r99:.2f}%, VaR={100*VaR:.2f}%")
    
    h=0.1
    E = VaR*(1+h)-h
    RWA = E*1.5
    print(f"E={100*E:.2f}% RWA={RWA*100:.2f}%")
    plt.show()