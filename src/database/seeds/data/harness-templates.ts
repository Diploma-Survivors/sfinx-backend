/**
 * Harness code templates for batched testcase execution.
 *
 * Each template:
 *  - Contains the // {{USER_CODE}} placeholder where user code is injected
 *  - Reads packed stdin (byte-count prefix protocol)
 *  - Runs user code per testcase with per-testcase I/O redirection
 *  - Outputs packed results (M lines with AC/WA/RE + timing)
 *  - Stops after the first failed testcase (fail-fast)
 */

export const HARNESS_TEMPLATES: Record<string, string> = {
  python3: `import sys, io, time as _time
_USER_CODE = r"""
// {{USER_CODE}}
"""
def _rb(d, p):
    nl = d.index(b'\\n', p); n = int(d[p:nl]); p = nl + 1
    return d[p:p+n].decode('utf-8', errors='replace'), p + n
def _wb(b, s):
    enc = s.encode('utf-8'); return b + str(len(enc)).encode() + b'\\n' + enc
_raw = sys.stdin.buffer.read()
_p = 0; _nl = _raw.index(b'\\n'); _n = int(_raw[_p:_nl]); _p = _nl + 1
_inp, _exp = [], []
for _ in range(_n):
    _i, _p = _rb(_raw, _p); _inp.append(_i)
    _e, _p = _rb(_raw, _p); _exp.append(_e)
_NC = '__NOCHECK__'; _res = []
for _i in range(_n):
    _oi, _oo = sys.stdin, sys.stdout
    _si = io.StringIO(_inp[_i]); _so = io.StringIO()
    sys.stdin, sys.stdout = _si, _so
    _t0 = _time.monotonic()
    try:
        exec(compile(_USER_CODE, '<solution>', 'exec'), {'__name__': '__main__', 'sys': sys, '__builtins__': __builtins__})
        _act = _so.getvalue(); _ms = int((_time.monotonic()-_t0)*1000)
        _s = 'AC' if (_exp[_i]==_NC or _act.rstrip('\\n')==_exp[_i].rstrip('\\n')) else 'WA'
    except Exception as _ex:
        _act = str(_ex); _ms = int((_time.monotonic()-_t0)*1000); _s = 'RE'
    finally:
        sys.stdin, sys.stdout = _oi, _oo
    _res.append((_s,_ms,_act,_inp[_i],_exp[_i]))
    if _s != 'AC': break
_o = (str(len(_res))+'\\n').encode()
for _s,_ms,_act,_i2,_e2 in _res:
    _o += (_s+'\\n'+str(_ms)+'\\n').encode(); _o = _wb(_o, _act)
    if _s == 'AC': _o += b'0\\n0\\n'
    else: _o = _wb(_wb(_o, _i2), _e2)
sys.stdout.buffer.write(_o)
`,

  c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#define main user_solve
// {{USER_CODE}}
#undef main
static char *_slurp(size_t n) {
    char *b = (char*)malloc(n+1); if (n>0) fread(b,1,n,stdin); b[n]=0; return b;
}
static size_t _rlen(void) {
    char ln[32]; fgets(ln,sizeof ln,stdin); return (size_t)atol(ln);
}
static void _wblk(FILE *f, const char *s, size_t l) {
    fprintf(f,"%zu\\n",l); fwrite(s,1,l,f);
}
int main(void) {
    char ln[32]; fgets(ln,sizeof ln,stdin); int n=atoi(ln);
    char **inp=(char**)malloc(n*sizeof*inp), **exp=(char**)malloc(n*sizeof*exp);
    size_t *il=(size_t*)malloc(n*sizeof*il), *el=(size_t*)malloc(n*sizeof*el);
    for(int i=0;i<n;i++){il[i]=_rlen();inp[i]=_slurp(il[i]);el[i]=_rlen();exp[i]=_slurp(el[i]);}
    FILE *ro=stdout;
    typedef struct{const char*st;long long ms;char*out;size_t olen;}Res;
    Res *rs=(Res*)malloc(n*sizeof(Res)); int m=0;
    for(int i=0;i<n;i++){
        FILE *fi=fmemopen(inp[i],il[i],"r");
        char *ob=NULL; size_t os=0; FILE *fo=open_memstream(&ob,&os);
        FILE *si=stdin,*so=stdout; stdin=fi; stdout=fo;
        struct timespec t0,t1; clock_gettime(CLOCK_MONOTONIC,&t0);
        user_solve();
        clock_gettime(CLOCK_MONOTONIC,&t1);
        stdin=si; stdout=so; fflush(fo); fclose(fi); fclose(fo);
        long long ms=(t1.tv_sec-t0.tv_sec)*1000LL+(t1.tv_nsec-t0.tv_nsec)/1000000LL;
        size_t al=os,xl=el[i];
        while(al>0&&(ob[al-1]=='\\n'||ob[al-1]=='\\r'))al--;
        while(xl>0&&(exp[i][xl-1]=='\\n'||exp[i][xl-1]=='\\r'))xl--;
        int nc=strcmp(exp[i],"__NOCHECK__")==0;
        int ac=nc||(al==xl&&(al==0||memcmp(ob,exp[i],al)==0));
        rs[m].st=ac?"AC":"WA"; rs[m].ms=ms; rs[m].out=ob; rs[m].olen=os; m++;
        if(!ac) break;
    }
    fprintf(ro,"%d\\n",m);
    for(int i=0;i<m;i++){
        fprintf(ro,"%s\\n%lld\\n",rs[i].st,rs[i].ms);
        _wblk(ro,rs[i].out,rs[i].olen);
        if(strcmp(rs[i].st,"AC")==0) fprintf(ro,"0\\n0\\n");
        else{_wblk(ro,inp[i],il[i]);_wblk(ro,exp[i],el[i]);}
        free(rs[i].out);
    }
    return 0;
}
`,

  cpp: `#include <bits/stdc++.h>
using namespace std;
#define main user_solve
// {{USER_CODE}}
#undef main
static string _rblk(istream &in){
    string l; getline(in,l); size_t n=(size_t)stoull(l);
    string d(n,'\\0'); if(n>0) in.read(&d[0],(streamsize)n); return d;
}
static void _wblk(ostream &out,const string &s){
    out<<s.size()<<'\\n'; out.write(s.data(),(streamsize)s.size());
}
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr);
    string l; getline(cin,l); int n=stoi(l);
    vector<string> inp(n),exp(n);
    for(int i=0;i<n;i++){inp[i]=_rblk(cin);exp[i]=_rblk(cin);}
    auto trim=[](string s){while(!s.empty()&&(s.back()=='\\n'||s.back()=='\\r'))s.pop_back();return s;};
    struct Res{string st;long long ms;string out;};
    vector<Res> rs; rs.reserve(n);
    for(int i=0;i<n;i++){
        istringstream fi(inp[i]); ostringstream fo;
        auto *bi=cin.rdbuf(fi.rdbuf()), *bo=cout.rdbuf(fo.rdbuf());
        auto t0=chrono::steady_clock::now();
        user_solve();
        auto t1=chrono::steady_clock::now();
        cin.rdbuf(bi); cout.rdbuf(bo);
        long long ms=chrono::duration_cast<chrono::milliseconds>(t1-t0).count();
        string act=fo.str();
        bool nc=(exp[i]=="__NOCHECK__"),ac=nc||(trim(act)==trim(exp[i]));
        rs.push_back({ac?"AC":"WA",ms,act});
        if(!ac) break;
    }
    int m=(int)rs.size(); cout<<m<<'\\n';
    for(int i=0;i<m;i++){
        cout<<rs[i].st<<'\\n'<<rs[i].ms<<'\\n';
        _wblk(cout,rs[i].out);
        if(rs[i].st=="AC") cout<<"0\\n0\\n";
        else{_wblk(cout,inp[i]);_wblk(cout,exp[i]);}
    }
    return 0;
}
`,

  java: `import java.io.*;
import java.nio.charset.*;
// {{USER_CODE}}
public class Main {
    static byte[] _rb(DataInputStream in) throws IOException {
        String l=_rl(in); int n=Integer.parseInt(l.trim());
        byte[] b=new byte[n]; int off=0;
        while(off<n){int r=in.read(b,off,n-off);if(r<0)break;off+=r;}
        return b;
    }
    static String _rl(DataInputStream in) throws IOException {
        StringBuilder sb=new StringBuilder(); int b;
        while((b=in.read())!=-1&&b!='\\n'){if(b!='\\r')sb.append((char)b);} return sb.toString();
    }
    static void _wb(OutputStream out,byte[] d) throws IOException {
        out.write((d.length+"\\n").getBytes(StandardCharsets.UTF_8)); out.write(d);
    }
    public static void main(String[] args) throws Exception {
        DataInputStream ri=new DataInputStream(System.in);
        OutputStream ro=System.out;
        int n=Integer.parseInt(_rl(ri).trim());
        byte[][] inp=new byte[n][],exp=new byte[n][];
        for(int i=0;i<n;i++){inp[i]=_rb(ri);exp[i]=_rb(ri);}
        String[] st=new String[n]; long[] ts=new long[n]; byte[][] outs=new byte[n][]; int m=0;
        for(int i=0;i<n;i++){
            ByteArrayInputStream fi=new ByteArrayInputStream(inp[i]);
            ByteArrayOutputStream fo=new ByteArrayOutputStream();
            System.setIn(fi);
            PrintStream ps=new PrintStream(fo,true,"UTF-8");
            System.setOut(ps);
            long t0=System.currentTimeMillis();
            try{Solution.solve();}
            catch(Exception e){
                System.setIn(ri); System.setOut(new PrintStream(ro,true,"UTF-8"));
                ts[i]=System.currentTimeMillis()-t0;
                outs[i]=(e.getMessage()!=null?e.getMessage():"RE").getBytes(StandardCharsets.UTF_8);
                st[i]="RE"; m++; break;
            }
            System.setIn(ri); System.setOut(new PrintStream(ro,true,"UTF-8"));
            ts[i]=System.currentTimeMillis()-t0;
            outs[i]=fo.toByteArray();
            String act=new String(outs[i],StandardCharsets.UTF_8).stripTrailing();
            String expected=new String(exp[i],StandardCharsets.UTF_8).stripTrailing();
            boolean nc=expected.equals("__NOCHECK__");
            st[i]=(nc||act.equals(expected))?"AC":"WA"; m++;
            if(!"AC".equals(st[i])) break;
        }
        ro.write((m+"\\n").getBytes(StandardCharsets.UTF_8));
        for(int i=0;i<m;i++){
            ro.write((st[i]+"\\n"+ts[i]+"\\n").getBytes(StandardCharsets.UTF_8));
            _wb(ro,outs[i]);
            if("AC".equals(st[i])) ro.write("0\\n0\\n".getBytes(StandardCharsets.UTF_8));
            else{_wb(ro,inp[i]);_wb(ro,exp[i]);}
        }
        ro.flush();
    }
}
`,

  javascript: `'use strict';
const fs=require('fs');
function _rb(raw,pos){const nl=raw.indexOf(10,pos),n=parseInt(raw.slice(pos,nl));pos=nl+1;return[raw.slice(pos,pos+n),pos+n];}
function _wb(cks,s){const b=Buffer.from(String(s),'utf8');cks.push(Buffer.from(b.length+'\\n'));cks.push(b);}
const raw=fs.readFileSync('/dev/stdin');
let pos=0;const nl0=raw.indexOf(10);const n=parseInt(raw.slice(0,nl0));pos=nl0+1;
const inputs=[],expecteds=[];
for(let i=0;i<n;i++){let b;[b,pos]=_rb(raw,pos);inputs.push(b);[b,pos]=_rb(raw,pos);expecteds.push(b);}
function __userSolve(){
// {{USER_CODE}}
}
const NOCHECK='__NOCHECK__';const results=[];
for(let i=0;i<n;i++){
    const inputStr=inputs[i].toString('utf8');let captured='';
    const origRFS=fs.readFileSync;
    fs.readFileSync=(p,e)=>(p===0||p==='/dev/stdin')?(e?inputStr:inputs[i]):origRFS.call(fs,p,e);
    const origLog=console.log,origErr=console.error,origWarn=console.warn;
    const origWrite=process.stdout.write.bind(process.stdout);
    console.log=(...a)=>{captured+=a.join(' ')+'\\n';};
    console.error=console.warn=()=>{};
    process.stdout.write=s=>{captured+=String(s);return true;};
    const t0=Date.now();let status;
    try{
        __userSolve();
        const ms=Date.now()-t0;const exp=expecteds[i].toString('utf8');const nc=exp===NOCHECK;
        status=(nc||captured.trimEnd()===exp.trimEnd())?'AC':'WA';
        results.push({status,ms,actual:captured,input:inputStr,expected:exp});
    }catch(e){
        const ms=Date.now()-t0;status='RE';
        results.push({status,ms,actual:String(e.message||e),input:inputStr,expected:expecteds[i].toString('utf8')});
    }finally{
        fs.readFileSync=origRFS;
        console.log=origLog;console.error=origErr;console.warn=origWarn;
        process.stdout.write=origWrite;
    }
    if(status!=='AC')break;
}
const chunks=[Buffer.from(results.length+'\\n')];
for(const r of results){chunks.push(Buffer.from(r.status+'\\n'+r.ms+'\\n'));_wb(chunks,r.actual);if(r.status==='AC')chunks.push(Buffer.from('0\\n0\\n'));else{_wb(chunks,r.input);_wb(chunks,r.expected);}}
process.stdout.write(Buffer.concat(chunks));
`,

  typescript: `// @ts-nocheck
const fs=require('fs');
function _rb(raw,pos){const nl=raw.indexOf(10,pos),n=parseInt(raw.slice(pos,nl));pos=nl+1;return[raw.slice(pos,pos+n),pos+n];}
function _wb(cks,s){const b=Buffer.from(String(s),'utf8');cks.push(Buffer.from(b.length+'\\n'));cks.push(b);}
const raw=fs.readFileSync('/dev/stdin');
let pos=0;const nl0=raw.indexOf(10);const n=parseInt(raw.slice(0,nl0));pos=nl0+1;
const inputs=[],expecteds=[];
for(let i=0;i<n;i++){let b;[b,pos]=_rb(raw,pos);inputs.push(b);[b,pos]=_rb(raw,pos);expecteds.push(b);}
function __userSolve(){
// {{USER_CODE}}
}
const NOCHECK='__NOCHECK__';const results=[];
for(let i=0;i<n;i++){
    const inputStr=inputs[i].toString('utf8');let captured='';
    const origRFS=fs.readFileSync;
    fs.readFileSync=(p,e)=>(p===0||p==='/dev/stdin')?(e?inputStr:inputs[i]):origRFS.call(fs,p,e);
    const origLog=console.log,origErr=console.error,origWarn=console.warn;
    const origWrite=process.stdout.write.bind(process.stdout);
    console.log=(...a)=>{captured+=a.join(' ')+'\\n';};
    console.error=console.warn=()=>{};
    process.stdout.write=s=>{captured+=String(s);return true;};
    const t0=Date.now();let status;
    try{
        __userSolve();
        const ms=Date.now()-t0;const exp=expecteds[i].toString('utf8');const nc=exp===NOCHECK;
        status=(nc||captured.trimEnd()===exp.trimEnd())?'AC':'WA';
        results.push({status,ms,actual:captured,input:inputStr,expected:exp});
    }catch(e){
        const ms=Date.now()-t0;status='RE';
        results.push({status,ms,actual:String(e.message||e),input:inputStr,expected:expecteds[i].toString('utf8')});
    }finally{
        fs.readFileSync=origRFS;
        console.log=origLog;console.error=origErr;console.warn=origWarn;
        process.stdout.write=origWrite;
    }
    if(status!=='AC')break;
}
const chunks=[Buffer.from(results.length+'\\n')];
for(const r of results){chunks.push(Buffer.from(r.status+'\\n'+r.ms+'\\n'));_wb(chunks,r.actual);if(r.status==='AC')chunks.push(Buffer.from('0\\n0\\n'));else{_wb(chunks,r.input);_wb(chunks,r.expected);}}
process.stdout.write(Buffer.concat(chunks));
`,

  go: `package main

import (
\t"bufio"
\t"fmt"
\t"io"
\t"math"
\t"math/big"
\t"os"
\t"sort"
\t"strconv"
\t"strings"
\t"time"
)

var _, _, _, _, _, _ = math.Abs, big.NewInt, sort.Ints, strconv.Itoa, strings.TrimSpace, time.Now

// {{USER_CODE}}

func _rblk(r *bufio.Reader) string {
\tl, _ := r.ReadString('\\n')
\tn, _ := strconv.Atoi(strings.TrimRight(l, "\\r\\n"))
\tb := make([]byte, n)
\tio.ReadFull(r, b)
\treturn string(b)
}
func _wblk(w *bufio.Writer, s string) {
\tfmt.Fprintf(w, "%d\\n", len(s))
\tw.WriteString(s)
}
func main() {
\trawIn := bufio.NewReader(os.Stdin)
\trealOut := bufio.NewWriter(os.Stdout)
\tdefer realOut.Flush()
\tnLine, _ := rawIn.ReadString('\\n')
\tn, _ := strconv.Atoi(strings.TrimRight(nLine, "\\r\\n"))
\tinputs := make([]string, n)
\texpecteds := make([]string, n)
\tfor i := 0; i < n; i++ {
\t\tinputs[i] = _rblk(rawIn)
\t\texpecteds[i] = _rblk(rawIn)
\t}
\ttype Result struct {
\t\tstatus string
\t\tms     int64
\t\tout    string
\t}
\tresults := make([]Result, 0, n)
\tconst NOCHECK = "__NOCHECK__"
\tfor i := 0; i < n; i++ {
\t\tinR, inW, _ := os.Pipe()
\t\toutR, outW, _ := os.Pipe()
\t\tgo func(data string) { inW.WriteString(data); inW.Close() }(inputs[i])
\t\toldIn, oldOut := os.Stdin, os.Stdout
\t\tos.Stdin, os.Stdout = inR, outW
\t\tt0 := time.Now()
\t\tuserSolve()
\t\tms := time.Since(t0).Milliseconds()
\t\tos.Stdin, os.Stdout = oldIn, oldOut
\t\toutW.Close(); inR.Close()
\t\tvar sb strings.Builder
\t\tio.Copy(&sb, outR); outR.Close()
\t\tactual := sb.String()
\t\texp := expecteds[i]
\t\tnc := exp == NOCHECK
\t\tac := nc || strings.TrimRight(actual, "\\r\\n") == strings.TrimRight(exp, "\\r\\n")
\t\tstatus := "WA"
\t\tif ac { status = "AC" }
\t\tresults = append(results, Result{status, ms, actual})
\t\tif status != "AC" { break }
\t}
\tfmt.Fprintf(realOut, "%d\\n", len(results))
\tfor i, r := range results {
\t\tfmt.Fprintf(realOut, "%s\\n%d\\n", r.status, r.ms)
\t\t_wblk(realOut, r.out)
\t\tif r.status == "AC" {
\t\t\tfmt.Fprint(realOut, "0\\n0\\n")
\t\t} else {
\t\t\t_wblk(realOut, inputs[i])
\t\t\t_wblk(realOut, expecteds[i])
\t\t}
\t}
}
`,

  rust: `use std::io::{self, BufRead, BufReader, BufWriter, Read, Write};
use std::os::raw::c_int;
use std::os::unix::io::FromRawFd;
use std::time::Instant;

extern "C" {
    fn dup(fd: c_int) -> c_int;
    fn dup2(oldfd: c_int, newfd: c_int) -> c_int;
    fn pipe(fds: *mut c_int) -> c_int;
    fn close(fd: c_int) -> c_int;
}

// {{USER_CODE}}

fn _rblk<R: BufRead>(r: &mut R) -> Vec<u8> {
    let mut l = String::new(); r.read_line(&mut l).unwrap();
    let n: usize = l.trim().parse().unwrap_or(0);
    let mut b = vec![0u8; n]; r.read_exact(&mut b).unwrap_or(()); b
}
fn _wblk<W: Write>(w: &mut W, d: &[u8]) {
    write!(w, "{}\\n", d.len()).unwrap(); w.write_all(d).unwrap();
}

fn main() {
    let stdin = io::stdin();
    let mut raw = BufReader::new(stdin.lock());
    let mut l = String::new(); raw.read_line(&mut l).unwrap();
    let n: usize = l.trim().parse().unwrap_or(0);
    let mut inputs: Vec<Vec<u8>> = Vec::with_capacity(n);
    let mut expecteds: Vec<Vec<u8>> = Vec::with_capacity(n);
    for _ in 0..n { inputs.push(_rblk(&mut raw)); expecteds.push(_rblk(&mut raw)); }
    drop(raw);
    struct Res { status: &'static str, ms: u128, out: Vec<u8> }
    let mut results: Vec<Res> = Vec::new();
    for i in 0..n {
        let mut in_fds = [0i32; 2]; let mut out_fds = [0i32; 2];
        unsafe { pipe(in_fds.as_mut_ptr()); pipe(out_fds.as_mut_ptr()); }
        { let mut pw = unsafe { std::fs::File::from_raw_fd(in_fds[1]) }; pw.write_all(&inputs[i]).unwrap(); }
        let sv_in = unsafe { dup(0) }; let sv_out = unsafe { dup(1) };
        unsafe { dup2(in_fds[0], 0); dup2(out_fds[1], 1); close(in_fds[0]); close(out_fds[1]); }
        let t0 = Instant::now();
        user_solve();
        let ms = t0.elapsed().as_millis();
        io::stdout().flush().ok();
        unsafe { dup2(sv_in, 0); dup2(sv_out, 1); close(sv_in); close(sv_out); }
        let mut out_data = Vec::new();
        { let mut pr = unsafe { std::fs::File::from_raw_fd(out_fds[0]) }; pr.read_to_end(&mut out_data).ok(); }
        let exp = &expecteds[i];
        let at = out_data.iter().rposition(|&b| b!=b'\\n'&&b!=b'\\r').map(|p|&out_data[..=p]).unwrap_or(&[]);
        let et = exp.iter().rposition(|&b| b!=b'\\n'&&b!=b'\\r').map(|p|&exp[..=p]).unwrap_or(&[]);
        let nc = exp.as_slice()==b"__NOCHECK__"; let ac = nc||at==et;
        let status: &'static str = if ac {"AC"} else {"WA"};
        results.push(Res{status,ms,out:out_data});
        if !ac { break; }
    }
    let mut wo = BufWriter::new(io::stdout());
    write!(wo, "{}\\n", results.len()).unwrap();
    for (i, r) in results.iter().enumerate() {
        write!(wo, "{}\\n{}\\n", r.status, r.ms).unwrap();
        _wblk(&mut wo, &r.out);
        if r.status=="AC" { write!(wo, "0\\n0\\n").unwrap(); }
        else { _wblk(&mut wo, &inputs[i]); _wblk(&mut wo, &expecteds[i]); }
    }
    wo.flush().unwrap();
}
`,

  csharp: `using System;
using System.IO;
using System.Text;
// {{USER_CODE}}
class Solution {
    static readonly Encoding _enc=new UTF8Encoding(false);
    static byte[] _rb(Stream s) {
        var sb=new StringBuilder(); int b;
        while((b=s.ReadByte())!=-1&&b!='\\n'){if(b!='\\r')sb.Append((char)b);}
        int n=int.Parse(sb.ToString().Trim());
        var buf=new byte[n]; int off=0;
        while(off<n){int r=s.Read(buf,off,n-off);if(r<=0)break;off+=r;}
        return buf;
    }
    static void _wb(Stream s,byte[] d){
        var l=_enc.GetBytes(d.Length+"\\n"); s.Write(l,0,l.Length); s.Write(d,0,d.Length);
    }
    static void Main(){
        var ri=Console.OpenStandardInput();
        var ro=Console.OpenStandardOutput();
        var nl=new StringBuilder(); int b;
        while((b=ri.ReadByte())!=-1&&b!='\\n'){if(b!='\\r')nl.Append((char)b);}
        int n=int.Parse(nl.ToString().Trim());
        var inp=new byte[n][]; var exp=new byte[n][];
        for(int i=0;i<n;i++){inp[i]=_rb(ri);exp[i]=_rb(ri);}
        var st=new string[n]; var ts=new long[n]; var outs=new byte[n][]; int m=0;
        for(int i=0;i<n;i++){
            var fi=new MemoryStream(inp[i]); var fo=new MemoryStream();
            var swo=new StreamWriter(fo,_enc){AutoFlush=true};
            Console.SetIn(new StreamReader(fi,_enc));
            Console.SetOut(swo);
            var t0=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            try{UserSolution.UserSolve();}
            catch(Exception ex){
                swo.Flush();
                Console.SetIn(new StreamReader(ri,_enc));
                Console.SetOut(new StreamWriter(ro,_enc){AutoFlush=true});
                ts[i]=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()-t0;
                outs[i]=_enc.GetBytes(ex.Message??"RE");
                st[i]="RE"; m++; break;
            }
            swo.Flush();
            Console.SetIn(new StreamReader(ri,_enc));
            Console.SetOut(new StreamWriter(ro,_enc){AutoFlush=true});
            ts[i]=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()-t0;
            outs[i]=fo.ToArray();
            var act=_enc.GetString(outs[i]).TrimEnd();
            var expected=_enc.GetString(exp[i]).TrimEnd();
            bool nc=expected=="__NOCHECK__";
            st[i]=(nc||act==expected)?"AC":"WA"; m++;
            if(st[i]!="AC") break;
        }
        var mb=_enc.GetBytes(m+"\\n"); ro.Write(mb,0,mb.Length);
        for(int i=0;i<m;i++){
            var hdr=_enc.GetBytes(st[i]+"\\n"+ts[i]+"\\n"); ro.Write(hdr,0,hdr.Length);
            _wb(ro,outs[i]);
            if(st[i]=="AC"){var z=_enc.GetBytes("0\\n0\\n");ro.Write(z,0,z.Length);}
            else{_wb(ro,inp[i]);_wb(ro,exp[i]);}
        }
        ro.Flush();
    }
}
`,

  php: `<?php
function _rb(&$data,&$pos){$nl=strpos($data,"\\n",$pos);$n=(int)substr($data,$pos,$nl-$pos);$pos=$nl+1;$b=substr($data,$pos,$n);$pos+=$n;return $b;}
function _wb($s){return strlen($s)."\\n".$s;}
function __stdin(){global $__si;return $__si;}
function __split($raw){
    $c=preg_replace('/^\\s*<\\?php\\s*/i','',$raw);
    $tk=token_get_all('<?php '.$c);array_shift($tk);
    $K=[T_CLASS,T_INTERFACE,T_TRAIT,T_ABSTRACT,T_FINAL];
    foreach(['T_READONLY','T_ENUM'] as $x)if(defined($x))$K[]=constant($x);
    $d='';$m='';$dp=0;$b='';$in=false;
    for($j=0,$l=count($tk);$j<$l;$j++){
        $t=$tk[$j];$s=is_array($t)?$t[1]:$t;
        if(!$in&&$dp===0&&is_array($t)){
            if(in_array($t[0],$K)){$in=true;$b=$s;continue;}
            if($t[0]===T_FUNCTION){
                $k=$j+1;
                while($k<$l&&is_array($tk[$k])&&$tk[$k][0]===T_WHITESPACE)$k++;
                if($k<$l&&is_array($tk[$k])&&$tk[$k][0]===T_STRING){$in=true;$b=$s;continue;}
            }
        }
        if($in){$b.=$s;if($s==='{')$dp++;elseif($s==='}'){$dp--;if(!$dp){$d.=$b;$b='';$in=false;}}}
        else $m.=$s;
    }
    return[$d,$m];
}
$raw=file_get_contents("php://stdin");$pos=0;
$nl=strpos($raw,"\\n");$n=(int)substr($raw,0,$nl);$pos=$nl+1;
$inputs=[];$expecteds=[];
for($i=0;$i<$n;$i++){$inputs[]=_rb($raw,$pos);$expecteds[]=_rb($raw,$pos);}
$USER_CODE=<<<'USERCODE'
// {{USER_CODE}}
USERCODE;
$__uc=str_replace('STDIN','__stdin()',$USER_CODE);
[$__rdecl,$__rmain]=__split($__uc);
if($__rdecl!=='')eval($__rdecl);
$NOCHECK="__NOCHECK__";$results=[];
for($i=0;$i<$n;$i++){
    ob_start();
    $t0=microtime(true);
    $__si=fopen('php://memory','r+b');
    fwrite($__si,$inputs[$i]);
    rewind($__si);
    try{
        eval($__rmain);
        $actual=ob_get_clean();
        $ms=(int)((microtime(true)-$t0)*1000);
        $nc=$expecteds[$i]===$NOCHECK;
        $s=($nc||rtrim($actual,"\\r\\n")===rtrim($expecteds[$i],"\\r\\n"))?"AC":"WA";
    } catch(\\Throwable $e){
        $actual=ob_get_clean()??"";
        $ms=(int)((microtime(true)-$t0)*1000);
        $s="RE";$actual=$e->getMessage();
    } finally {
        if(is_resource($__si))fclose($__si);
    }
    $results[]=[$s,$ms,$actual,$inputs[$i],$expecteds[$i]];
    if($s!=="AC") break;
}
$out=count($results)."\\n";
foreach($results as [$s,$ms,$act,$inp,$exp]){
    $out.=$s."\\n".$ms."\\n"._wb($act);
    if($s==="AC") $out.="0\\n0\\n";
    else $out.=_wb($inp)._wb($exp);
}
fwrite(STDOUT,$out);
`,

  ruby: `require 'stringio'
def _rb(data, pos)
    nl=data.index("\\n",pos); n=data[pos...nl].to_i; pos=nl+1
    [data[pos,n],pos+n]
end
def _wb(s); b=s.encode('UTF-8').b; "#{b.bytesize}\\n#{b}"; end
raw=$stdin.binmode.read; pos=0
nl=raw.index("\\n"); n=raw[0...nl].to_i; pos=nl+1
inputs=[]; expecteds=[]
n.times{inp,pos=_rb(raw,pos);exp,pos=_rb(raw,pos);inputs<<inp;expecteds<<exp}
USER_CODE=<<~'RUBY'
// {{USER_CODE}}
RUBY
NOCHECK="__NOCHECK__"; results=[]
n.times do |i|
    $stdin=StringIO.new(inputs[i]); $stdout=StringIO.new
    t0=Process.clock_gettime(Process::CLOCK_MONOTONIC)
    begin
        eval(USER_CODE)
        actual=$stdout.string
        ms=((Process.clock_gettime(Process::CLOCK_MONOTONIC)-t0)*1000).to_i
        nc=expecteds[i]==NOCHECK
        s=(nc||actual.rstrip==expecteds[i].rstrip)?"AC":"WA"
    rescue=>e
        actual=e.message; ms=((Process.clock_gettime(Process::CLOCK_MONOTONIC)-t0)*1000).to_i; s="RE"
    ensure
        $stdin=STDIN; $stdout=STDOUT
    end
    results<<[s,ms,actual,inputs[i],expecteds[i]]
    break if s!="AC"
end
out="#{results.size}\\n"
results.each do|s,ms,act,inp,exp|
    out+="#{s}\\n#{ms}\\n"+_wb(act)
    out+=s=="AC"?"0\\n0\\n":_wb(inp)+_wb(exp)
end
STDOUT.binmode.write(out)
`,

  kotlin: `import java.io.*
import java.nio.charset.*
// {{USER_CODE}}
fun main() {
    val ri=DataInputStream(System.\`in\`)
    val ro=System.out
    fun rl():String{val sb=StringBuilder();var b:Int;while(ri.read().also{b=it}!=-1&&b!='\\n'.toInt()){if(b!='\\r'.toInt())sb.append(b.toChar())};return sb.toString()}
    fun rb():ByteArray{val n=rl().trim().toInt();val b=ByteArray(n);var off=0;while(off<n){val r=ri.read(b,off,n-off);if(r<0)break;off+=r};return b}
    fun wb(out:OutputStream,d:ByteArray){out.write((d.size.toString()+"\\n").toByteArray());out.write(d)}
    val n=rl().trim().toInt()
    val inp=Array(n){rb()}; val exp=Array(n){rb()}
    val st=arrayOfNulls<String>(n); val ts=LongArray(n); val outs=arrayOfNulls<ByteArray>(n); var m=0
    for(i in 0 until n){
        val fi=ByteArrayInputStream(inp[i]); val fo=ByteArrayOutputStream()
        System.setIn(fi); System.setOut(PrintStream(fo,true,"UTF-8"))
        val t0=System.currentTimeMillis()
        try{userSolve()}
        catch(e:Exception){
            System.setIn(ri); System.setOut(PrintStream(ro,true,"UTF-8"))
            ts[i]=System.currentTimeMillis()-t0
            outs[i]=(e.message?:"RE").toByteArray(StandardCharsets.UTF_8)
            st[i]="RE"; m++; break
        }
        System.setIn(ri); System.setOut(PrintStream(ro,true,"UTF-8"))
        ts[i]=System.currentTimeMillis()-t0; outs[i]=fo.toByteArray()
        val act=String(outs[i]!!,StandardCharsets.UTF_8).trimEnd()
        val expected=String(exp[i],StandardCharsets.UTF_8).trimEnd()
        val nc=expected=="__NOCHECK__"
        st[i]=if(nc||act==expected)"AC" else "WA"; m++
        if(st[i]!="AC") break
    }
    ro.write((m.toString()+"\\n").toByteArray())
    for(i in 0 until m){
        ro.write((st[i]+"\\n"+ts[i]+"\\n").toByteArray())
        wb(ro,outs[i]!!)
        if(st[i]=="AC") ro.write("0\\n0\\n".toByteArray())
        else{wb(ro,inp[i]);wb(ro,exp[i])}
    }
    ro.flush()
}
`,
};
