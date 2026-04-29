#!/bin/bash
git remote remove github 2>/dev/null || true
git remote add github https://montanarojordan-tech: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@github.com/montanarojordan-tech/goutstoso-app.git
git push github main
