
            timeout /t 2 /nobreak >nul
            taskkill /f /im electron.exe 2>nul
            timeout /t 1 /nobreak >nul
            move "C:\Users\TheSM\OneDrive\Documents\GitHub\writegeist-desktop\writegeist_temp.db" "C:\Users\TheSM\OneDrive\Documents\GitHub\writegeist-desktop\writegeist.db"
            timeout /t 1 /nobreak >nul
            cd "C:\Users\TheSM\OneDrive\Documents\GitHub\writegeist-desktop"
            npm start
          