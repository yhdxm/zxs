import urllib.request, time, os
LOG = "D:/代码/zxs-main/scripts/ocr_out/_ocrhost.log"
def log(m):
    with open(LOG,"a",encoding="utf-8") as f: f.write(f"[{time.strftime('%H:%M:%S')}] {m}\n"); f.flush()
hosts = {
  "bcebos_paddle_det": "https://paddleocr.bj.bcebos.com/PP-OCRv3/chinese/ch_PP-OCRv3_det_infer.tar",
  "aliyun_oss": "https://modelscope.oss-cn-beijing.aliyuncs.com/models/iic/cv_resnet18_ocr-detection-line-level_damo/pytorch_model.bin",
  "modelscope": "https://modelscope.cn/api/v1/models/daydreamer/README.md",
}
for name,url in hosts.items():
    log(f"=== {name}")
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
        t0=time.time()
        with urllib.request.urlopen(req,timeout=20) as r:
            data=r.read(8192); dt=time.time()-t0
            log(f"  OK status={r.status} got={len(data)}B in {dt:.1f}s")
    except Exception as e:
        dt=time.time()-t0 if 't0' in dir() else 0
        log(f"  FAIL {dt:.0f}s: {repr(e)[:130]}")
log("DONE")
