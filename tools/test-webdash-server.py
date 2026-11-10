import importlib.util,sys,threading,concurrent.futures,urllib.request,time,json,io,collections
from pathlib import Path
spec=importlib.util.spec_from_file_location('server','tools/webdash-server.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.PRODUCTION=True;m.ORIGINS={'*'}
class Quiet(m.NoCacheHandler):
 def log_message(self,*args):pass
server=m.WebDashServer(('127.0.0.1',0),lambda *a,**kw:Quiet(*a,directory=str(m.ROOT),**kw));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_port)
calls=0;active=0;peak=0;guard=threading.Lock()
class Stream(io.BytesIO):
 def __init__(self):super().__init__(b'x'*1048576);self.headers={'Content-Type':'audio/ogg'}
class Opener:
 def open(self,req,timeout):
  global calls,active,peak
  with guard:calls+=1;active+=1;peak=max(peak,active)
  time.sleep(.15)
  with guard:active-=1
  return Stream()
m.urllib.request.build_opener=lambda *args:Opener()
def get(path):
 # Use the unpatched urlopen's default opener (not build_opener).
 req=urllib.request.Request(base+path)
 with original_open(req,timeout=30) as res:
  count=0
  while chunk:=res.read(65536):count+=len(chunk)
  return res.status,count,res.headers.get('X-WebDash-Cache')
original_open=urllib.request.urlopen
# Materialize the default opener before patch-free local calls.
import http.client
def local(path):
 c=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=30);c.request('GET',path);r=c.getresponse();status=r.status;cache=r.getheader('X-WebDash-Cache');n=0
 while chunk:=r.read(65536):n+=len(chunk)
 c.close();return status,n,cache
try:
 t=time.perf_counter()
 with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:rows=list(pool.map(lambda _:local('/gd-audio?url=https%3A%2F%2Fgeometrydashfiles.b-cdn.net%2Fsfx%2Fs4451.ogg'),range(20)))
 assert all(r[0]==200 and r[1]==1048576 for r in rows),rows
 assert calls==1,calls
 print('PASS 20 simultaneous downloads:',collections.Counter(r[2] for r in rows),'one upstream fetch',round(time.perf_counter()-t,3),'s')
 with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:list(pool.map(lambda n:local('/gd-audio?url=https%3A%2F%2Fgeometrydashfiles.b-cdn.net%2Fsfx%2Fs'+str(n)+'.ogg'),range(20)))
 assert peak<=6,peak
 print('PASS distinct downloads limited to',peak,'upstream requests')
 for path in ['/.git/config','/tools/webdash-server.py','/work/','/assets/%2e%2e/tools/webdash-server.py']:
  assert local(path)[0]==404,path
 assert local('/gd-audio?url=http://127.0.0.1/')[0]==400
 assert local('/gd-health')[0]==200
 print('PASS production health, private-path isolation and audio URL allowlist')
 class FailedOpener:
  def open(self,*args,**kwargs):raise urllib.error.URLError(ConnectionRefusedError('private diagnostic path'))
 m.urllib.request.build_opener=lambda *args:FailedOpener()
 c=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=30)
 c.request('GET','/gd-audio?url=https%3A%2F%2Fgeometrydashfiles.b-cdn.net%2Fsfx%2Fs9999999.ogg');r=c.getresponse();body=r.read()
 assert r.status==503 and r.getheader('X-WebDash-Upstream-Error')=='ConnectionRefusedError'
 assert b'private diagnostic path' not in body
 c.close();print('PASS upstream failures expose a safe error class and keep private details in server logs')
finally:server.shutdown();server.server_close();m.CACHE.close()
