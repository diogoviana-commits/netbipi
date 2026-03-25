@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

:: ============================================================
::  NetBIPI - Hub Operacional
::  Gerenciador de inicializacao
:: ============================================================

title NetBIPI - Hub Operacional

:MENU
cls
echo.
echo  ================================================================
echo   NetBIPI ^| Network ^& Infrastructure Business Intelligence
echo  ================================================================
echo.
echo   [1] Iniciar NetBIPI  (somente hub - ambiente local)
echo   [2] Iniciar NetBIPI + Zabbix
echo   [3] Iniciar NetBIPI + GLPI
echo   [4] Iniciar TUDO  (NetBIPI + Zabbix + GLPI)
echo   [5] Configurar integracoes  (Zabbix + GLPI)
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
set /p OPCAO="  Escolha uma opcao: "

if "%OPCAO%"=="1" goto START_CORE
if "%OPCAO%"=="2" goto START_MONITORING
if "%OPCAO%"=="3" goto START_ITSM
if "%OPCAO%"=="4" goto START_FULL
if "%OPCAO%"=="5" goto SETUP_INTEGRACOES
if "%OPCAO%"=="6" goto STATUS
if "%OPCAO%"=="7" goto LOGS_BACKEND
if "%OPCAO%"=="8" goto PARAR
if /i "%OPCAO%"=="F" goto FIX_PASSWORDS
if /i "%OPCAO%"=="R" goto RESET_DB
if "%OPCAO%"=="9" goto REINICIAR
if "%OPCAO%"=="0" goto FIM
goto MENU

:: ============================================================
:VERIFICAR_DOCKER
:: ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check-docker.ps1" >nul 2>&1
if %ERRORLEVEL% equ 0 exit /b 0

echo.
echo  Docker nao esta rodando. Iniciando Docker Desktop...
echo.

:: Tenta iniciar o Docker Desktop automaticamente
set DOCKER_PATHS=^
    "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" ^
    "%LocalAppData%\Docker\Docker Desktop.exe" ^
    "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"

set DOCKER_FOUND=0
for %%P in (%DOCKER_PATHS%) do (
    if exist %%P (
        start "" %%P
        set DOCKER_FOUND=1
        goto AGUARDAR_DOCKER
    )
)

if %DOCKER_FOUND%==0 (
    echo  [ERRO] Docker Desktop nao encontrado.
    echo         Baixe em: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    goto MENU
)

:AGUARDAR_DOCKER
echo  Aguardando Docker Desktop iniciar ^(pode levar ate 60 segundos^)...
echo.
set /a TENTATIVA=0
:LOOP_DOCKER
set /a TENTATIVA+=1
if %TENTATIVA% gtr 20 (
    echo  [ERRO] Docker demorou para iniciar. Abra o Docker Desktop manualmente e tente novamente.
    pause
    goto MENU
)
docker info >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo  Docker pronto^!
    exit /b 0
)
<nul set /p "=  Tentativa %TENTATIVA%/20..."
timeout /t 5 >nul
echo.
goto LOOP_DOCKER

:: ============================================================
:START_CORE
:: ============================================================
call :VERIFICAR_DOCKER
echo.
echo  Iniciando NetBIPI ^(sem Zabbix/GLPI configurados^)...
echo.
docker-compose up -d --build
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [ERRO] Falha ao iniciar os containers. Verifique o Docker.
    pause
    goto MENU
)
call :AGUARDAR_BACKEND
call :ABRIR_BROWSER http://localhost
goto MENU

:: ============================================================
:START_MONITORING
:: ============================================================
call :VERIFICAR_DOCKER
echo.
echo  Iniciando NetBIPI + Zabbix...
echo.
docker-compose --profile monitoring up -d --build
if %ERRORLEVEL% neq 0 (
    echo  [ERRO] Falha ao iniciar. Verifique o Docker.
    pause
    goto MENU
)
call :AGUARDAR_BACKEND
echo.
echo  Servicos disponiveis:
echo    NetBIPI  -^> http://localhost
echo    Zabbix   -^> http://localhost:8080  ^(Admin / zabbix^)
echo.
call :ABRIR_BROWSER http://localhost
goto MENU

:: ============================================================
:START_ITSM
:: ============================================================
call :VERIFICAR_DOCKER
echo.
echo  Iniciando NetBIPI + GLPI...
echo.
docker-compose --profile itsm up -d --build
if %ERRORLEVEL% neq 0 (
    echo  [ERRO] Falha ao iniciar. Verifique o Docker.
    pause
    goto MENU
)
call :AGUARDAR_BACKEND
echo.
echo  Servicos disponiveis:
echo    NetBIPI  -^> http://localhost
echo    GLPI     -^> http://localhost:8081  ^(glpi / glpi^)
echo.
call :ABRIR_BROWSER http://localhost
goto MENU

:: ============================================================
:START_FULL
:: ============================================================
call :VERIFICAR_DOCKER
echo.
echo  Iniciando TODOS os servicos ^(NetBIPI + Zabbix + GLPI^)...
echo  Isso pode levar alguns minutos na primeira execucao.
echo.
docker-compose --profile full up -d --build
if %ERRORLEVEL% neq 0 (
    echo  [ERRO] Falha ao iniciar. Verifique o Docker.
    pause
    goto MENU
)
call :AGUARDAR_BACKEND
echo.
echo  ================================================================
echo   Todos os servicos iniciados^!
echo  ================================================================
echo.
echo    NetBIPI  -^> http://localhost         ^(admin@netbipi.local / admin123^)
echo    Zabbix   -^> http://localhost:8080    ^(Admin / zabbix^)
echo    GLPI     -^> http://localhost:8081    ^(glpi / glpi^)
echo    API      -^> http://localhost:3001/health
echo.
echo  Dica: Use a opcao [5] para configurar as integracoes automaticamente.
echo.
call :ABRIR_BROWSER http://localhost
pause
goto MENU

:: ============================================================
:SETUP_INTEGRACOES
:: ============================================================
echo.
echo  Configurando integracoes Zabbix + GLPI...
echo.

:: Verificar se Python esta disponivel
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    python3 --version >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo  [AVISO] Python nao encontrado.
        echo          Instale o Python 3 para configurar o Zabbix automaticamente.
        echo          Download: https://www.python.org/downloads/
        echo.
        echo  Abrindo configuracao manual do GLPI via Docker...
        docker exec netbipi-glpi-mariadb mysql -u glpi -pglpi_pass glpi -e "UPDATE glpi_configs SET value='1' WHERE context='core' AND name='enable_api'; UPDATE glpi_configs SET value='1' WHERE context='core' AND name='enable_api_login_credentials'; UPDATE glpi_configs SET value='1' WHERE context='core' AND name='enable_api_login_external_token';" >nul 2>&1
        echo  GLPI API habilitada.
        pause
        goto MENU
    )
    set PYTHON_CMD=python3
) else (
    set PYTHON_CMD=python
)

echo  Instalando dependencias Python...
%PYTHON_CMD% -m pip install requests --quiet

echo.
echo  [1/2] Configurando Zabbix...
%PYTHON_CMD% zabbix\setup\configure_zabbix.py --url http://localhost:8080/api_jsonrpc.php --netbipi-url http://backend:3001

echo.
echo  [2/2] Configurando GLPI via Docker...
docker exec netbipi-glpi-mariadb mysql -u glpi -pglpi_pass glpi -e "UPDATE glpi_configs SET value='1' WHERE context='core' AND name='enable_api'; UPDATE glpi_configs SET value='1' WHERE context='core' AND name='enable_api_login_credentials'; UPDATE glpi_configs SET value='1' WHERE context='core' AND name='enable_api_login_external_token'; DELETE FROM glpi_apiclient WHERE name='NetBIPI Integration'; INSERT INTO glpi_apiclient (entities_id,name,app_token,app_token_date,ipv4_range_start,ipv4_range_end,is_active,comment,date_creation,date_mod) VALUES (0,'NetBIPI Integration','netbipi-glpi-app-token',NOW(),0,4294967295,1,'NetBIPI Hub',NOW(),NOW()); UPDATE glpi_users SET api_token='netbipi-glpi-user-token',api_token_date=NOW() WHERE name IN ('glpi','admin') LIMIT 1;" 2>nul
if %ERRORLEVEL% equ 0 (
    echo  GLPI configurado com sucesso^!
) else (
    echo  [AVISO] GLPI pode nao estar pronto ainda. Tente novamente em 2 minutos.
)

echo.
echo  ================================================================
echo   Configuracao concluida^!
echo  ================================================================
echo.
echo   Para ativar as integracoes reais, mantenha MOCK_INTEGRATIONS=false:
echo     MOCK_INTEGRATIONS=false
echo     GLPI_APP_TOKEN=netbipi-glpi-app-token
echo     GLPI_USER_TOKEN=netbipi-glpi-user-token
echo.
echo   Use MOCK_INTEGRATIONS=true apenas para laboratorio sem Zabbix/GLPI.
echo.
echo   E reinicie o backend com a opcao [9].
echo.
pause
goto MENU

:: ============================================================
:STATUS
:: ============================================================
echo.
echo  ================================================================
echo   Status dos containers NetBIPI
echo  ================================================================
echo.
docker ps --filter "name=netbipi" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.
echo  --- Health do Backend ---
curl -s http://localhost:3001/health 2>nul || echo  Backend indisponivel ou ainda iniciando...
echo.
pause
goto MENU

:: ============================================================
:LOGS_BACKEND
:: ============================================================
call :VERIFICAR_DOCKER
echo.
echo  Exibindo as ultimas 100 linhas do backend...
echo.
docker ps -a --filter "name=netbipi-backend" --format "{{.Names}}" | findstr /i "netbipi-backend" >nul
if %ERRORLEVEL% neq 0 (
    echo  [AVISO] Container netbipi-backend nao encontrado.
    echo          Inicie o projeto pela opcao [1], [2], [3] ou [4].
    echo.
    pause
    goto MENU
)

docker logs --tail 100 netbipi-backend 2>&1
echo.
echo  Pressione qualquer tecla para voltar ao menu.
pause >nul
goto MENU

:: ============================================================
:PARAR
:: ============================================================
echo.
echo  Parando todos os servicos NetBIPI...
echo.
docker-compose --profile full down
echo.
echo  Servicos parados.
echo.
pause
goto MENU

:: ============================================================
:REINICIAR
:: ============================================================
echo.
echo  Reconstruindo e reiniciando backend...
echo.
docker-compose up -d --build backend
call :AGUARDAR_BACKEND
echo.
echo  Backend reiniciado.
echo.
pause
goto MENU

:: ============================================================
:AGUARDAR_BACKEND
:: ============================================================
echo.
echo  Aguardando backend ficar disponivel...
set /a TENTATIVA=0
:LOOP_WAIT
set /a TENTATIVA+=1
if %TENTATIVA% gtr 30 (
    echo  [AVISO] Backend demorou mais que o esperado. Verifique os logs ^(opcao 7^).
    exit /b 0
)
curl -s http://localhost:3001/health >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo  Backend pronto^!
    exit /b 0
)
<nul set /p "=  Aguardando... tentativa %TENTATIVA%/30"
timeout /t 3 >nul
echo.
goto LOOP_WAIT

:: ============================================================
:ABRIR_BROWSER
:: ============================================================
echo.
echo  Abrindo navegador em %~1 ...
start "" "%~1"
timeout /t 2 >nul
exit /b 0

:: ============================================================
:RESET_DB
:: ============================================================
echo.
echo  ATENCAO: Isso vai apagar todos os dados do banco e recriar com
echo  os dados iniciais. Use apenas para resolver problemas de login.
echo.
set /p CONFIRMAR="  Confirma o reset? (S/N): "
if /i not "%CONFIRMAR%"=="S" goto MENU

echo.
echo  Parando containers...
docker-compose --profile full down 2>nul
docker-compose down 2>nul

echo  Removendo volume do banco...
docker volume rm netbipi_postgres_data 2>nul

echo  Reiniciando NetBIPI...
docker-compose up -d --build
call :AGUARDAR_BACKEND

echo.
echo  ================================================================
echo   Banco resetado^! Credenciais:
echo     admin@netbipi.local  /  admin123
echo     n1@netbipi.local     /  analyst123
echo     n2@netbipi.local     /  analyst123
echo  ================================================================
echo.
call :ABRIR_BROWSER http://localhost
pause
goto MENU

:: ============================================================
:FIX_PASSWORDS
:: ============================================================
echo.
echo  Corrigindo senhas de acesso...
echo.

docker ps --filter "name=netbipi-backend" --filter "status=running" | findstr "netbipi-backend" >nul
if %ERRORLEVEL% neq 0 (
    echo  [ERRO] Container netbipi-backend nao esta rodando.
    echo         Inicie o NetBIPI primeiro ^(opcao 1^) e tente novamente.
    pause
    goto MENU
)

docker cp scripts\fix-passwords.js netbipi-backend:/app/fix-passwords.js >nul 2>&1
docker exec netbipi-backend node /app/fix-passwords.js

if %ERRORLEVEL% equ 0 (
    echo.
    echo  ================================================================
    echo   Credenciais de acesso:
    echo     admin@netbipi.local   /  admin123
    echo     n1@netbipi.local      /  analyst123
    echo     n2@netbipi.local      /  analyst123
    echo  ================================================================
    echo.
    call :ABRIR_BROWSER http://localhost
) else (
    echo.
    echo  [ERRO] Falha ao corrigir senhas. Veja os logs ^(opcao 7^).
)
pause
goto MENU

:: ============================================================
:FIM
:: ============================================================
echo.
echo  Ate logo^!
echo.
exit /b 0
