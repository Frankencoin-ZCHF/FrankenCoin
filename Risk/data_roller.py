import datetime
from math import dist
import requests
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats
import statsmodels.api as sm

#https://api.exchange.bitpanda.com/public/v1/candlesticks/BTC_CHF?unit=HOURS&period=1&from=2020-10-03T04%3A59%3A59.999Z&to=2020-12-03T07%3A59%3A59.999Z
#https://api.exchange.bitpanda.com/public/v1/candlesticks/BTC_CHF?unit=HOURS&period=1&from=2020-10-03T04:59:59.999Z&to=2020-12-03T07:59:59.999Z
def minutes_between(d1, d2):
    delta = d2 - d1
    return delta.total_seconds() / 60

def construct_query(t0, t1):
    base = "https://api.exchange.bitpanda.com/public/v1/candlesticks/BTC_CHF?unit=HOURS&period=1"
    sT0 = "&from="+t0.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
    sT1 = "&to="+t1.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
    return base+sT0+sT1

def update_data(response, DF):
    response._content
    a_json = json.loads(response._content)
    df = pd.DataFrame.from_dict(a_json)
    if len(df) == 0:
        print("response empty")
        return DF
    # timestamp in seconds
    df['timestamp'] = df['time'].apply(lambda x: int(pd.Timestamp(x).value/1e9))
    return DF.append(df)

def analyze_gaps(DF):
    print("#duplicates=", sum(DF['timestamp'].duplicated()))
    ts_start = np.min(DF["timestamp"])
    ts_end = np.max(DF["timestamp"])
    timestamp_expected = np.arange(ts_start, ts_end+1, 3600)
    timestamp_missing = np.setdiff1d(timestamp_expected, DF["timestamp"])
    print("Missing ", len(timestamp_missing)/len(timestamp_expected))
    DF["Y-MM"] = DF['timestamp'].apply(lambda x: datetime.datetime.utcfromtimestamp(x).strftime('%Y-%m'))
    YM = DF["Y-MM"].drop_duplicates().to_numpy()
    missing_ratio = np.zeros(YM.shape) 
    for k in range(YM.shape[0]):
        df_ts_curr = DF["timestamp"][DF["Y-MM"]==YM[k]]
        ts_start = np.min(df_ts_curr)
        ts_end = np.max(df_ts_curr)
        timestamp_expected = np.arange(ts_start, ts_end+1, 3600)
        timestamp_missing = np.setdiff1d(timestamp_expected, df_ts_curr)
        missing_ratio[k] = len(timestamp_missing)/len(timestamp_expected)
    plt.bar(YM, missing_ratio)
    plt.xticks(rotation=45)
    plt.ylim(0,1)
    plt.ylabel("#Missing Observations / #Expected Observations")
    plt.show()

def monthly_boxplot(DF):
    DF["Y-MM"] = DF['timestamp'].apply(lambda x: datetime.datetime.utcfromtimestamp(x).strftime('%Y-%m'))
    DF['open'] = DF["open"].apply(lambda x: float(x))
    DF['datetime'] = pd.to_datetime(DF['time'])
    df = DF[['datetime', 'open']]
    df.set_index('datetime')
    plt.plot(df['datetime'], df['open'])
    plt.title("time series")
    plt.ylabel("BTCCHF")
    plt.grid()
    plt.show()

def analyze_returns(DF):
    DF["logRet"] = DF["close"].apply(lambda x: np.log(float(x))) - DF["open"].apply(lambda x: np.log(float(x)))
    M = DF[["timestamp", "logRet"]].to_numpy()
    print("Return statistics")
    print(stats.describe(M[:,1]))
    m = np.mean(M[:,1])
    s = np.sqrt(np.var(M[:,1]))
    sm.qqplot((M[:,1]-m)/s, stats.t, distargs=(4,), loc=0, scale=1, line='s')
    plt.grid(True)
    plt.xlabel("Quantile t-distribution, df=4")
    #plt.savefig("docs/qq_tdist.png")
    plt.show()
    sm.qqplot((M[:,1]-m)/s, stats.norm, loc=0, scale=1, line='s')
    plt.grid(True)
    plt.xlabel("Quantile normal distribution")
    #plt.savefig("docs/qq_normal.png")
    plt.show()
    plt.boxplot(M[:,1])
    plt.show()
    plt.hist(M[:,1], 100)
    plt.show()


def poll_data():
    MAX_POLL = 500
    date_from = datetime.datetime.strptime('2020-03-01T16:41:24+0200', "%Y-%m-%dT%H:%M:%S%z")
    date_to = datetime.datetime.strptime('2022-01-14T16:41:24+0200', "%Y-%m-%dT%H:%M:%S%z")

    H = pd.DataFrame()

    delta_sec = MAX_POLL * 60
    t1 = date_from
    idx = 0
    while (t1 < date_to):
        t0 = t1 + datetime.timedelta(0, 3600);
        t1 = t0 + datetime.timedelta(0, delta_sec);
        sQuery = construct_query(t0, t1)
        print("query ", idx, "t0=", t0, "t1=", t1)
        response = requests.get(sQuery)
        H = update_data(response, H)
        idx = idx + 1

    H.sort_values(by = "timestamp", inplace=True)  
    print("data collected")
    H.to_pickle("./Risk/data_raw.pkl")
    print("data stored")

#poll_data()
DF = pd.read_pickle("./Risk/data_raw.pkl")
print("Price statistics")
print(stats.describe(DF["close"].apply(lambda x: (float(x)))))


#analyze_gaps(DF)
#analyze_returns(DF)
monthly_boxplot(DF)
