param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
# Read-only alpha audit. The sheet pixels are never modified.
Add-Type -ReferencedAssemblies System.Drawing.Common,System.Drawing.Primitives,System.Private.Windows.GdiPlus,System.Private.Windows.Core -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class WalkSheetBounds {
 public static int[][] Read(string path) {
  using(var b=new Bitmap(path)) {
   var data=b.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
   try {
    var bytes=new byte[data.Stride*b.Height];Marshal.Copy(data.Scan0,bytes,0,bytes.Length);
    var result=new int[4][];
    var cuts=new int[]{0,0,0,0,b.Width};
    for(int col=1;col<4;col++) {
     int center=col*b.Width/4,best=int.MaxValue;
     for(int x=center-b.Width/32;x<=center+b.Width/32;x++) {
      int count=0;for(int y=0;y<b.Height;y++)if(bytes[y*data.Stride+x*4+3]>32)count++;
      if(count<best||(count==best&&Math.Abs(x-center)<Math.Abs(cuts[col]-center))){best=count;cuts[col]=x;}
     }
     if(best>0)throw new Exception("No transparent separator near frame "+col);
    }
    for(int col=0;col<4;col++) {
     int start=cuts[col],end=cuts[col+1],minX=end,minY=b.Height,maxX=-1,maxY=-1;
     for(int y=0;y<b.Height;y++)for(int x=start;x<end;x++)if(bytes[y*data.Stride+x*4+3]>32){minX=Math.Min(minX,x);minY=Math.Min(minY,y);maxX=Math.Max(maxX,x);maxY=Math.Max(maxY,y);}
     if(maxX<0)throw new Exception("Empty frame "+col);
     result[col]=new[]{minX,minY,maxX-minX+1,maxY-minY+1};
    }
    return result;
   } finally {b.UnlockBits(data);}
  }
 }
}
'@
$resolved = (Resolve-Path -LiteralPath $Path).Path
$bitmap = [System.Drawing.Bitmap]::new($resolved)
try {
 @{width=$bitmap.Width;height=$bitmap.Height;boxes=[WalkSheetBounds]::Read($resolved)} | ConvertTo-Json -Depth 5 -Compress
} finally { $bitmap.Dispose() }

