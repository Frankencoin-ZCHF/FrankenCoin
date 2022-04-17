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

#source: https://support.kraken.com/hc/en-us/articles/360047124832-Downloadable-historical-OHLCVT-Open-High-Low-Close-Volume-Trades-data 
# --> https://drive.google.com/drive/folders/1aoA6SKgPbS_p3pYStXUXFvmjqShJ2jv9

def load_from_file(tau="60"):
    col_names = ["timestamp", "open", "high", "low", "close", "volume", "trades"]
    DF = pd.read_csv("./Risk/XBTCHF_"+str(tau)+".csv", header=0, names = col_names)
    DF["datetime"] =DF['timestamp'].apply(lambda x: datetime.datetime.utcfromtimestamp(x))
    DF["logRet"] = np.log(DF["close"]) - np.log(DF["open"])
    DF["maxRet"] = np.log(DF["high"]) - np.log(DF["open"])
    return DF


tau = "1440"#"60"
DF = load_from_file(tau)
#data_roller.analyze_gaps(DF, 1440)
data_roller.analyze_returns(DF, 8)

#data_roller.timeseries_plot(DF)
# first version was without maxRet
#DF.to_pickle("XBTCHF_"+str(tau)+"_Processed_v2.pkl")
