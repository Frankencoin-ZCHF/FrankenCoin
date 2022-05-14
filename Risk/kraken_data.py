import datetime
from math import dist
import requests
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats
import data_roller

#source: https://support.kraken.com/hc/en-us/articles/360047124832-Downloadable-historical-OHLCVT-Open-High-Low-Close-Volume-Trades-data 
# --> https://drive.google.com/drive/folders/1aoA6SKgPbS_p3pYStXUXFvmjqShJ2jv9

def load_from_file(tau="60"):
    col_names = ["timestamp", "open", "high", "low", "close", "volume", "trades"]
    DF = pd.read_csv("./Risk/XBTCHF_"+str(tau)+".csv", header=0, names = col_names)
    return DF

def load_from_api(since: int, interval=1440):
    s_query = f"https://api.kraken.com/0/public/OHLC?pair=XBTCHF&interval={interval}&since={since}"
    response = requests.get(s_query)
    response._content
    a_json = json.loads(response._content)
    df = pd.DataFrame.from_dict(a_json["result"]["XBTCHF"])
    col_names = ["timestamp", "open", "high", "low", "close", "vwap", "volume", "trades"]
    df.columns = col_names
    df.drop(["vwap"], axis = 1, inplace=True)
    return df

def merge_data(DF1:pd.DataFrame, DF2:pd.DataFrame) -> pd.DataFrame:
    DF = pd.concat([DF1, DF2])
    for k in range(DF.shape[1]):
        DF.iloc[:, k] = pd.to_numeric(DF.iloc[:, k])

    DF["datetime"] =DF['timestamp'].apply(lambda x: datetime.datetime.utcfromtimestamp(x))
    DF["logRet"] = np.log(DF["close"]) - np.log(DF["open"])
    DF["maxRet"] = np.log(DF["high"]) - np.log(DF["open"])
    return DF

tau = "1440"#"60"
DF = load_from_file(tau)
since_ts = np.max(DF["timestamp"])
DF2 = load_from_api(since_ts, interval=1440)

DFmerged = merge_data(DF, DF2)

#data_roller.analyze_gaps(DFmerged, 1440)
#data_roller.analyze_returns(DFmerged, 8)
#data_roller.timeseries_plot(DFmerged)
# first version was without maxRet
# third version has data up to May (before end of Jan)
DFmerged.to_pickle("XBTCHF_"+str(tau)+"_Processed_v3.pkl")
