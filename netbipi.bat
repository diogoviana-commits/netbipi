@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "DOCKER_CLIENT_TIMEOUT=15"
set "COMPOSE_HTTP_TIMEOUT=15"
if not defined NETBIPI_DEMO_PASSWORD set "NETBIPI_DEMO_PASSWORD=NetBIPI@Demo2026"
if not defined GLPI_DB_PASSWORD set "GLPI_DB_PASSWORD=CHANGE_ME_GLPI_DB_PASSWORD"
if not defined GLPI_APP_TOKEN set "GLPI_APP_TOKEN=CHANGE_ME_GLPI_APP_TOKEN"
if not defined GLPI_USER_TOKEN set "GLPI_USER_TOKEN=CHANGE_ME_GLPI_USER_TOKEN"
if not defined ZABBIX_WEBHOOK_SECRET set "ZABBIX_WEBHOOK_SECRET=CHANGE_ME_ZABBIX_WEBHOOK_SECRET"

set "PROJECT_NAME="
for %%I in ("%CD%") do set "PROJECT_NAME=%%~nxI"

title NetBIPI - Hub Operacional

call :DetectCompose
if errorlevel 1 goto NO_COMPOSE
goto MENU

:NO_COMPOSE
echo.
echo  [ERRO] Nao encontrei "docker compose" nem "docker-compose" no PATH.
echo         Instale o Docker Desktop ou o Compose e tente novamente.
echo.
pause
exit /b 1

:MENU
cls
echo.
echo  ================================================================
echo   NetBIPI ^| Network ^& Infrastructure Business Intelligence
echo  ================================================================
echo.
echo   [1] Iniciar NetBIPI  ^(somente hub - ambiente local^)
echo   [2] Iniciar NetBIPI + Zabbix
echo   [3] Iniciar NetBIPI + GLPI
echo   [4] Iniciar TUDO  ^(NetBIPI + Zabbix + GLPI^)
echo   [5] Configurar integracoes  ^(Zabbix + GLPI^)
echo   [6] Ver status dos containers
echo   [7] Ver ultimos logs do backend
echo   [8] Parar todos os servicos
echo   [9] Reiniciar e reconstruir backend
echo   [F] Corrigir senhas de acesso
echo   [R] Resetar banco de dados  ^(resolve problemas de login^)
echo   [0] Sair
echo.
echo  ================================================================
echo.
set "OPCAO="
set /p "OPCAO=  Escolha uma opcao: "

if not defined OPCAO goto MENU
if /i "%OPCAO%"=="1" goto START_CORE
if /i "%OPCAO%"=="2" goto START_MONITORING
if /i "%OPCAO%"=="3" goto START_ITSM
if /i "%OPCAO%"=="4" goto START_FULL
if /i "%OPCAO%"=="5" goto SETUP_INTEGRACOES
if /i "%OPCAO%"=="6" goto STATUS
if /i "%OPCAO%"=="7" goto LOGS_BACKEND
if /i "%OPCAO%"=="8" goto PARAR
if /i "%OPCAO%"=="9" goto REINICIAR
if /i "%OPCAO%"=="F" goto FIX_PASSWORDS
if /i "%OPCAO%"=="R" goto RESET_DB
if /i "%OPCAO%"=="0" goto FIM
goto MENU

:DetectCompose
docker compose version >nul 2>&1
if not errorlevel 1 (
    set "COMPOSE_CMD=docker compose"
    exit /b 0
)
docker-compose version >nul 2>&1
if not errorlevel 1 (
    set "COMPOSE_CMD=docker-compose"
    exit /b 0
)
exit /b 1

:EnsureDocker
call :IsDockerDesktopRunning
if not errorlevel 1 exit /b 0

echo.
echo  Docker nao esta rodando. Tentando iniciar o Docker Desktop...
echo.

call :TryStartDockerDesktop
if errorlevel 1 (
    echo  [ERRO] Docker Desktop nao foi encontrado.
    echo         Verifique se o Docker esta instalado.
    echo.
    pause
    exit /b 1
)

call :WaitDockerDesktop
exit /b %errorlevel%

:IsDockerDesktopRunning
tasklist /FI "IMAGENAME eq Docker Desktop.exe" /NH | findstr /I /C:"Docker Desktop.exe" >nul
exit /b %errorlevel%

:TryStartDockerDesktop
for %%P in (
    "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    "%LocalAppData%\Docker\Docker Desktop.exe"
    "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
) do (
    if exist "%%~P" (
        start "" "%%~P"
        exit /b 0
    )
)
exit /b 1

:WaitDockerDesktop
echo  Aguardando Docker iniciar...
echo.
for /l %%I in (1,1,24) do (
    call :IsDockerDesktopRunning
    if not errorlevel 1 (
        echo  Docker Desktop pronto^!
        exit /b 0
    )
    if %%I lss 24 (
        <nul set /p "=  Tentativa %%I/24..."
        timeout /t 5 >nul
        echo.
    )
)
echo  [ERRO] Docker demorou para iniciar.
echo         Abra o Docker Desktop manualmente e tente novamente.
echo.
pause
exit /b 1

:RunCompose
%COMPOSE_CMD% %*
exit /b %errorlevel%

:RunComposeUp
echo  Iniciando containers em background...
start "" /min cmd /c "%COMPOSE_CMD% %*"
exit /b 0

:ContainerRunning
docker ps --format "{{.Names}}" | findstr /i /x "%~1" >nul
exit /b %errorlevel%

:DetectPython
set "PYTHON_CMD="
python --version >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=python"
    exit /b 0
)
python3 --version >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=python3"
    exit /b 0
)
exit /b 1

:EnsureRequests
%PYTHON_CMD% -c "import requests" >nul 2>&1
if not errorlevel 1 exit /b 0

echo  Instalando dependencia requests...
%PYTHON_CMD% -m pip install requests --quiet
exit /b %errorlevel%

:WaitBackend
echo.
echo  Aguardando backend iniciar...
echo.
timeout /t 1 >nul
echo  Se a pagina ainda nao abriu totalmente, atualize em alguns segundos.
echo.
exit /b 0

:OpenBrowser
echo.
echo  Abrindo navegador em %~1 ...
start "" "%~1"
timeout /t 2 >nul
exit /b 0

:START_CORE
call :EnsureDocker
if errorlevel 1 goto MENU
echo.
echo  Iniciando NetBIPI ^(somente hub - ambiente local^)...
echo.
call :RunComposeUp up -d
if errorlevel 1 goto COMPOSE_FAILED
call :OpenBrowser http://localhost
call :WaitBackend
goto MENU

:START_MONITORING
call :EnsureDocker
if errorlevel 1 goto MENU
echo.
echo  Iniciando NetBIPI + Zabbix...
echo.
call :RunComposeUp --profile monitoring up -d
if errorlevel 1 goto COMPOSE_FAILED
echo.
echo  Servicos disponiveis:
echo    NetBIPI  -^> http://localhost
echo    Zabbix   -^> http://localhost:8080  ^(configure via setup^)
echo.
call :OpenBrowser http://localhost
call :WaitBackend
goto MENU

:START_ITSM
call :EnsureDocker
if errorlevel 1 goto MENU
echo.
echo  Iniciando NetBIPI + GLPI...
echo.
call :RunComposeUp --profile itsm up -d
if errorlevel 1 goto COMPOSE_FAILED
echo.
echo  Servicos disponiveis:
echo    NetBIPI  -^> http://localhost
echo    GLPI     -^> http://localhost:8081  ^(tokens gerados no setup^)
echo.
call :OpenBrowser http://localhost
call :WaitBackend
goto MENU

:START_FULL
call :EnsureDocker
if errorlevel 1 goto MENU
echo.
echo  Iniciando TODOS os servicos ^(NetBIPI + Zabbix + GLPI^)...
echo  Isso pode levar alguns minutos na primeira execucao.
echo.
call :RunComposeUp --profile full up -d
if errorlevel 1 goto COMPOSE_FAILED
echo.
echo  ================================================================
echo   Todos os servicos iniciados^!
echo  ================================================================
echo.
echo    NetBIPI  -^> http://localhost         ^(contas demo no seed local^)
echo    Zabbix   -^> http://localhost:8080    ^(acesso local configurado no setup^)
echo    GLPI     -^> http://localhost:8081    ^(tokens gerados no setup^)
echo    API      -^> http://localhost:3001/health
echo.
echo  Dica: Use a opcao [5] para configurar as integracoes automaticamente.
echo.
call :OpenBrowser http://localhost
call :WaitBackend
pause
goto MENU

:SETUP_INTEGRACOES
call :EnsureDocker
if errorlevel 1 goto MENU
echo.
echo  Configurando integracoes Zabbix + GLPI...
echo.
set "INTEGRACOES_OK=0"

call :ContainerRunning netbipi-backend
if errorlevel 1 (
    echo  [AVISO] Backend nao esta rodando. Inicie o projeto primeiro.
    echo.
) else (
    call :ContainerRunning netbipi-zabbix-web
    if errorlevel 1 (
        echo  [AVISO] Zabbix nao esta rodando. Inicie a opcao [2] ou [4].
        echo.
    ) else (
        call :DetectPython
        if errorlevel 1 (
            echo  [AVISO] Python nao encontrado.
            echo          Instale o Python 3 para configurar o Zabbix automaticamente.
            echo          Download: https://www.python.org/downloads/
            echo.
        ) else (
            call :EnsureRequests
            if errorlevel 1 (
                echo  [AVISO] Nao consegui preparar a dependencia requests.
                echo.
            ) else (
                echo  [1/2] Configurando Zabbix...
                %PYTHON_CMD% zabbix\setup\configure_zabbix.py --url http://localhost:8080/api_jsonrpc.php --netbipi-url http://backend:3001
                if errorlevel 1 (
                    echo.
                    echo  [AVISO] Falha ao configurar Zabbix.
                    echo.
                ) else (
                    set "INTEGRACOES_OK=1"
                )
            )
        )
    )
)

call :ContainerRunning netbipi-glpi-mariadb
if errorlevel 1 (
    echo  [AVISO] GLPI nao esta rodando. Inicie a opcao [3] ou [4].
    echo.
) else (
    echo  [2/2] Configurando GLPI via Docker...
    docker exec netbipi-glpi-mariadb mysql -u glpi -p%GLPI_DB_PASSWORD% glpi -e "UPDATE glpi_configs SET value='1' WHERE context='core' AND name='enable_api'; UPDATE glpi_configs SET value='1' WHERE context='core' AND name='enable_api_login_credentials'; UPDATE glpi_configs SET value='1' WHERE context='core' AND name='enable_api_login_external_token'; DELETE FROM glpi_apiclient WHERE name='NetBIPI Integration'; INSERT INTO glpi_apiclient (entities_id,name,app_token,app_token_date,ipv4_range_start,ipv4_range_end,is_active,comment,date_creation,date_mod) VALUES (0,'NetBIPI Integration','%GLPI_APP_TOKEN%',NOW(),0,4294967295,1,'NetBIPI Hub',NOW(),NOW()); UPDATE glpi_users SET api_token='%GLPI_USER_TOKEN%',api_token_date=NOW() WHERE name IN ('glpi','admin') LIMIT 1;" 2>nul
    if errorlevel 1 (
        echo  [AVISO] GLPI pode nao estar pronto ainda. Tente novamente em 2 minutos.
    ) else (
        echo  GLPI configurado com sucesso^!
        set "INTEGRACOES_OK=1"
    )
    echo.
)

echo  ================================================================
if "%INTEGRACOES_OK%"=="1" (
echo   Configuracao concluida^!
) else (
echo   [AVISO] Nenhuma integracao foi configurada.
)
echo  ================================================================
echo.
echo   Para ativar as integracoes reais, mantenha MOCK_INTEGRATIONS=false:
echo     MOCK_INTEGRATIONS=false
echo     GLPI_APP_TOKEN=^<token-gerado^>
echo     GLPI_USER_TOKEN=^<token-gerado^>
echo.
echo   Use MOCK_INTEGRATIONS=true apenas para laboratorio sem Zabbix/GLPI.
echo.
echo   E reinicie o backend com a opcao [9].
echo.
pause
goto MENU

:STATUS
call :EnsureDocker
if errorlevel 1 goto MENU
echo.
echo  ================================================================
echo   Status dos containers NetBIPI
echo  ================================================================
echo.
docker ps --filter "name=netbipi" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.
echo  --- Health do Backend ---
where curl >nul 2>&1
if errorlevel 1 (
    echo  [AVISO] curl nao encontrado no PATH. Nao foi possivel testar o health.
) else (
    curl -fsS http://localhost:3001/health >nul 2>&1
    if errorlevel 1 (
        echo  Backend indisponivel ou ainda iniciando...
    ) else (
        echo  Backend OK
    )
)
echo.
pause
goto MENU

:LOGS_BACKEND
call :EnsureDocker
if errorlevel 1 goto MENU
echo.
echo  Exibindo as ultimas 100 linhas do backend...
echo.
call :ContainerRunning netbipi-backend
if errorlevel 1 (
    echo  [AVISO] Container netbipi-backend nao encontrado.
    echo          Inicie o projeto pela opcao [1], [2], [3] ou [4].
    echo.
    pause
    goto MENU
)
docker logs --tail 100 netbipi-backend 2>&1
echo.
pause
goto MENU

:PARAR
call :EnsureDocker
if errorlevel 1 goto MENU
echo.
echo  Parando todos os servicos NetBIPI...
echo.
call :RunCompose down --remove-orphans
echo.
echo  Servicos parados.
echo.
pause
goto MENU

:REINICIAR
call :EnsureDocker
if errorlevel 1 goto MENU
echo.
echo  Reconstruindo e reiniciando backend...
echo.
call :RunComposeUp up -d --build backend
if errorlevel 1 goto COMPOSE_FAILED
echo.
echo  Backend reiniciado.
echo.
call :OpenBrowser http://localhost
call :WaitBackend
pause
goto MENU

:RESET_DB
call :EnsureDocker
if errorlevel 1 goto MENU
echo.
echo  ATENCAO: Isso vai apagar os dados persistidos do projeto e recriar os servicos.
echo  Use apenas para resolver problemas de login.
echo.
set /p "CONFIRMAR=  Confirma o reset? (S/N): "
if /i not "%CONFIRMAR%"=="S" goto MENU

echo.
echo  Parando containers...
call :RunCompose down --remove-orphans

echo  Removendo volume do banco...
docker volume rm "%PROJECT_NAME%_postgres_data" >nul 2>&1

echo  Reiniciando NetBIPI...
call :RunComposeUp up -d
if errorlevel 1 goto COMPOSE_FAILED
echo.
echo  ================================================================
echo   Banco resetado^! Credenciais:
echo     contas demo definidas em database\init.sql
echo  ================================================================
echo.
call :OpenBrowser http://localhost
call :WaitBackend
pause
goto MENU

:FIX_PASSWORDS
call :EnsureDocker
if errorlevel 1 goto MENU
echo.
echo  Corrigindo senhas de acesso...
echo.

call :ContainerRunning netbipi-backend
if errorlevel 1 (
    echo  [ERRO] Container netbipi-backend nao esta rodando.
    echo         Inicie o NetBIPI primeiro ^(opcao 1^) e tente novamente.
    echo.
    pause
    goto MENU
)

docker cp scripts\fix-passwords.js netbipi-backend:/app/fix-passwords.js >nul 2>&1
docker exec netbipi-backend node /app/fix-passwords.js

if errorlevel 1 (
    echo.
    echo  [ERRO] Falha ao corrigir senhas. Veja os logs ^(opcao 7^).
    echo.
    pause
    goto MENU
)

echo.
echo  ================================================================
echo   Credenciais de acesso:
echo     contas demo definidas em database\init.sql
echo  ================================================================
echo.
call :OpenBrowser http://localhost
pause
goto MENU

:COMPOSE_FAILED
echo.
echo  [ERRO] Falha ao iniciar os containers. Verifique o Docker e tente novamente.
echo.
pause
goto MENU

:FIM
echo.
echo  Ate logo^!
echo.
exit /b 0
