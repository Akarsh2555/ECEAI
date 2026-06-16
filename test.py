import urllib.request
import json
req = urllib.request.Request(
    'https://qwjftnajfyylmqhltqgb.supabase.co/rest/v1/charger_units',
    headers={'apikey': 'sb_publishable_48WT4Q-k4MPuMG-lvdB1cw_TPX9RQvz'}
)
try:
    print(len(json.loads(urllib.request.urlopen(req).read().decode())))
except Exception as e:
    print(e)
