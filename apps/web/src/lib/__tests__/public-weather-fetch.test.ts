import dns from 'node:dns/promises';
import { request, type RequestOptions } from 'node:https';
import type { IncomingMessage, ClientRequest } from 'node:http';
import { EventEmitter } from 'node:events';
import type { PeerCertificate } from 'node:tls';
import { fetchPublicWeatherUrl, isPublicWeatherAddress } from '../public-weather-fetch';
jest.mock('node:dns/promises', () => ({ __esModule:true, default:{ lookup:jest.fn() } }));
jest.mock('node:https', () => ({ request:jest.fn() }));

let status = 200;
let body = Buffer.from('{"temp":20}');
beforeEach(() => {
  status = 200; body = Buffer.from('{"temp":20}');
  (dns.lookup as jest.Mock).mockResolvedValue([{address:'93.184.216.34',family:4}]);
  (request as jest.Mock).mockImplementation((options:RequestOptions, receive:(response:IncomingMessage)=>void) => {
    const req = new EventEmitter() as ClientRequest;
    req.end = jest.fn(() => {
      const response = Object.assign(new EventEmitter(), {
        statusCode:status, headers:{'content-type':'application/json',location:'https://127.0.0.1/'},
        destroy(error?:Error) { if(error) (this as unknown as EventEmitter).emit('error',error); return this; },
      });
      receive(response as unknown as IncomingMessage);
      if(status<300 || status>=400) { response.emit('data',body); response.emit('end'); }
      return req;
    });
    return req;
  });
});

test.each(['127.0.0.1','10.0.0.1','0.1.2.3','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','::ffff:10.0.0.1','fe80::1','2001:db8::1'])('rejects non-public address %s',async(address)=>{
  expect(isPublicWeatherAddress(address)).toBe(false);
  (dns.lookup as jest.Mock).mockResolvedValue([{address,family:address.includes(':')?6:4}]);
  await expect(fetchPublicWeatherUrl('https://weather.example.invalid/',new AbortController().signal)).rejects.toThrow('public');
  expect(request).not.toHaveBeenCalled();
});
test('pins public DNS to the connection and keeps hostname certificate verification',async()=>{
  (dns.lookup as jest.Mock).mockResolvedValueOnce([{address:'93.184.216.34',family:4}]).mockResolvedValue([{address:'127.0.0.1',family:4}]);
  const signal = new AbortController().signal;
  const response = await fetchPublicWeatherUrl('https://weather.example.invalid/data?q=rain',signal);
  expect(await response.json()).toEqual({temp:20});
  expect(dns.lookup).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    hostname:'93.184.216.34',servername:'weather.example.invalid',path:'/data?q=rain',signal,
    checkServerIdentity:expect.any(Function),headers:expect.objectContaining({Host:'weather.example.invalid'}),
  }),expect.any(Function));
  const options=(request as jest.Mock).mock.calls[0][0];
  expect(options.checkServerIdentity('93.184.216.34',{subjectaltname:'DNS:other.example.invalid'} as PeerCertificate)).toMatchObject({code:'ERR_TLS_CERT_ALTNAME_INVALID'});
  expect(options.checkServerIdentity('93.184.216.34',{subjectaltname:'DNS:weather.example.invalid'} as PeerCertificate)).toBeUndefined();
});
test('aborts during stalled DNS resolution without starting a request',async()=>{
  (dns.lookup as jest.Mock).mockImplementation(()=>new Promise(()=>{}));
  const controller=new AbortController();
  const result=fetchPublicWeatherUrl('https://weather.example.invalid/',controller.signal);
  controller.abort(new Error('synthetic cancellation'));
  await expect(result).rejects.toThrow('synthetic cancellation');
  expect(request).not.toHaveBeenCalled();
});
test('an already-aborted request does not start DNS resolution',async()=>{
  const controller=new AbortController();controller.abort(new Error('already canceled'));
  await expect(fetchPublicWeatherUrl('https://weather.example.invalid/',controller.signal)).rejects.toThrow('already canceled');
  expect(dns.lookup).not.toHaveBeenCalled();expect(request).not.toHaveBeenCalled();
});
test('retains bounded source revalidation and returns independently readable cached responses',async()=>{
  let now=1_000_000; jest.spyOn(Date,'now').mockImplementation(()=>now);
  const url='https://weather.example.invalid/cache-control';
  expect(await (await fetchPublicWeatherUrl(url,new AbortController().signal,300)).json()).toEqual({temp:20});
  expect(await (await fetchPublicWeatherUrl(url,new AbortController().signal,300)).json()).toEqual({temp:20});
  expect(request).toHaveBeenCalledTimes(1);
  now+=300_001;
  await fetchPublicWeatherUrl(url,new AbortController().signal,300);
  expect(request).toHaveBeenCalledTimes(2);
});
test('never follows a public-to-private redirect',async()=>{
  status=302;
  await expect(fetchPublicWeatherUrl('https://weather.example.invalid/',new AbortController().signal)).rejects.toThrow('redirect');
  expect(request).toHaveBeenCalledTimes(1);
});
test.each(['http://weather.example.invalid/','https://weather.example.invalid:444/','https://user:password@weather.example.invalid/'])('rejects invalid transport %s',async(url)=>{
  await expect(fetchPublicWeatherUrl(url,new AbortController().signal)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
test('rejects oversized provider bodies',async()=>{
  body=Buffer.alloc(1_048_577);
  await expect(fetchPublicWeatherUrl('https://weather.example.invalid/',new AbortController().signal)).rejects.toThrow('too large');
});
test('accepts globally routed IPv6 and safely returns empty provider responses',async()=>{
  expect(isPublicWeatherAddress('2606:4700:4700::1111')).toBe(true);
  status=204; body=Buffer.alloc(0);
  expect((await fetchPublicWeatherUrl('https://weather.example.invalid/',new AbortController().signal)).status).toBe(204);
});
