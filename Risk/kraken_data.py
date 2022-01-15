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

def load_from_file():
    col_names = ["timestamp", "open", "high", "low", "close", "volume", "trades"]
    DF = pd.read_csv("XBTCHF_60.csv", header=0, names = col_names)
    DF["datetime"] =DF['timestamp'].apply(lambda x: datetime.datetime.utcfromtimestamp(x))
    DF["logRet"] = np.log(DF["close"]) - np.log(DF["open"])
    return DF



DF = load_from_file()
#data_roller.analyze_gaps(DF)
#data_roller.analyze_returns(DF)
#data_roller.timeseries_plot(DF)
DF.to_pickle("XBTCHF_60_Processed.pkl")
