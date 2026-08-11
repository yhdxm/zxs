import ctypes, ctypes.wintypes

TH32CS_SNAPPROCESS = 0x00000002
PROCESS_QUERY_INFORMATION = 0x0400
PROCESS_VM_READ = 0x0010

class PROCESSENTRY32(ctypes.Structure):
    _fields_ = [("dwSize", ctypes.c_ulong),
                ("cntUsage", ctypes.c_ulong),
                ("th32ProcessID", ctypes.c_ulong),
                ("th32DefaultHeapID", ctypes.POINTER(ctypes.c_ulong)),
                ("th32ModuleID", ctypes.c_ulong),
                ("cntThreads", ctypes.c_ulong),
                ("th32ParentProcessID", ctypes.c_ulong),
                ("pcPriClassBase", ctypes.c_long),
                ("dwFlags", ctypes.c_ulong),
                ("szExeFile", ctypes.c_char * 260)]

kernel32 = ctypes.windll.kernel32

def get_cmdline(pid):
    h = kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, False, pid)
    if not h:
        return None
    try:
        buf = ctypes.create_unicode_buffer(4096)
        # use PSAPI or toolhelp; simplest: read via NtQueryInformationProcess is complex.
        # Use GetModuleFileNameEx via psapi
        psapi = ctypes.windll.psapi
        n = psapi.GetModuleFileNameExW(h, 0, buf, 4096)
        exe = buf.value if n else ""
        return exe
    finally:
        kernel32.CloseHandle(h)

candidates = [17208, 15884, 18820, 4516, 15808, 4408]
for pid in candidates:
    exe = get_cmdline(pid)
    print(f"PID {pid}: exe={exe}")
