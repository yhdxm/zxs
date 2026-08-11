"""精准终止所有 .venv_rapid 下的 OCR python 进程（按 exe 路径匹配，
绝不误杀 agent 运行时 versions/3.13.12/python.exe）。"""
import ctypes
kernel32 = ctypes.windll.kernel32
psapi = ctypes.windll.psapi
PROCESS_QUERY_INFORMATION = 0x0400
PROCESS_TERMINATE = 0x0001

def enum_pids():
    arr = (ctypes.c_uint * 4096)()
    needed = ctypes.c_uint()
    psapi.EnumProcesses.argtypes = [ctypes.POINTER(ctypes.c_uint), ctypes.c_uint, ctypes.POINTER(ctypes.c_uint)]
    psapi.EnumProcesses.restype = ctypes.c_int
    if not psapi.EnumProcesses(arr, ctypes.sizeof(arr), ctypes.byref(needed)):
        return []
    n = needed.value // ctypes.sizeof(ctypes.c_uint)
    return arr[:n]

def exe_of(pid):
    h = kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_TERMINATE, False, pid)
    if not h:
        return None
    buf = ctypes.create_unicode_buffer(2048)
    p = buf.value if psapi.GetModuleFileNameExW(h, 0, buf, 2048) else None
    kernel32.CloseHandle(h)
    return p

killed, skipped = [], []
for pid in enum_pids():
    if pid == 0:
        continue
    p = exe_of(pid)
    if not p:
        continue
    pl = p.replace("\\", "/").lower()
    if ".venv_rapid" in pl and pl.endswith("python.exe"):
        h = kernel32.OpenProcess(PROCESS_TERMINATE, False, pid)
        if h:
            ok = kernel32.TerminateProcess(h, 0)
            kernel32.CloseHandle(h)
            (killed if ok else skipped).append((pid, p))
    elif "versions/3.13.12/python.exe" in pl:
        skipped.append((pid, "AGENT-RUNTIME-KEPT"))
print("KILLED:", killed)
print("KEPT  :", skipped)
