#!/usr/bin/env python3
"""
Quick runner script for architecture comparison
"""

import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from architecture_comparison import main

if __name__ == "__main__":
    try:
        output_file, report_file = main()
        print(f"\n✅ Comparison completed successfully!")
        print(f"📊 Results: {output_file}")
        print(f"📋 Report: {report_file}")
    except Exception as e:
        print(f"❌ Error running comparison: {e}")
        import traceback
        traceback.print_exc()