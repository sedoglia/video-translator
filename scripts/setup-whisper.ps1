# Whisper Model Setup Script for Windows
# This script downloads and configures Whisper models for the Video Audio Translator

param(
    [string]$Model = "medium"
)

$ErrorActionPreference = "Stop"

# Configuration
$ModelsDir = Join-Path $PSScriptRoot "..\whisper-bin\models"
$Models = @{
    tiny = @{
        Name = "ggml-tiny.bin"
        Url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
        Size = "75 MB"
        Description = "Fastest model, good for quick testing"
    }
    base = @{
        Name = "ggml-base.bin"
        Url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
        Size = "142 MB"
        Description = "Fast model with better accuracy"
    }
    small = @{
        Name = "ggml-small.bin"
        Url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
        Size = "466 MB"
        Description = "Good balance of speed and accuracy"
    }
    medium = @{
        Name = "ggml-medium.bin"
        Url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin"
        Size = "1.5 GB"
        Description = "Best accuracy, recommended for production"
    }
    large = @{
        Name = "ggml-large-v3.bin"
        Url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"
        Size = "3.1 GB"
        Description = "Highest accuracy, slowest processing"
    }
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Show-AvailableModels {
    Write-ColorOutput "`n======================================================================" Cyan
    Write-ColorOutput "Available Whisper Models:" Cyan
    Write-ColorOutput "======================================================================" Cyan

    foreach ($key in $Models.Keys | Sort-Object) {
        $model = $Models[$key]
        $modelPath = Join-Path $ModelsDir $model.Name
        $installed = Test-Path $modelPath

        $status = if ($installed) { "[✓] " } else { "[✗] " }
        $color = if ($installed) { "Green" } else { "Yellow" }

        Write-ColorOutput "`n$status$($key.ToUpper())" $color
        Write-Host "    File: $($model.Name)"
        Write-Host "    Size: $($model.Size)"
        Write-Host "    $($model.Description)"

        if ($key -eq "medium") {
            Write-ColorOutput "    (Recommended)" Blue
        }
    }

    Write-ColorOutput "`n======================================================================" Cyan
}

function Test-GPUSupport {
    Write-ColorOutput "`nChecking GPU support..." Cyan

    try {
        $null = & nvidia-smi 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ NVIDIA GPU detected!" Green
            Write-ColorOutput "  CUDA acceleration will be available for faster processing." Green
            return $true
        }
    } catch {
        # nvidia-smi not found
    }

    Write-ColorOutput "✗ No NVIDIA GPU detected." Yellow
    Write-ColorOutput "  CPU-only mode will be used (slower)." Yellow
    return $false
}

function Download-Model {
    param(
        [string]$ModelKey
    )

    if (-not $Models.ContainsKey($ModelKey)) {
        Write-ColorOutput "✗ Error: Model '$ModelKey' not found." Red
        Write-ColorOutput "Available models: $($Models.Keys -join ', ')" Yellow
        exit 1
    }

    $model = $Models[$ModelKey]
    $modelPath = Join-Path $ModelsDir $model.Name

    # Check if model already exists
    if (Test-Path $modelPath) {
        $fileInfo = Get-Item $modelPath
        $sizeInMB = [math]::Round($fileInfo.Length / 1MB, 2)
        Write-ColorOutput "`n✓ Model '$ModelKey' already exists ($sizeInMB MB)" Green

        $answer = Read-Host "Do you want to re-download it? (y/N)"
        if ($answer -ne "y" -and $answer -ne "Y") {
            Write-ColorOutput "Skipping download." Yellow
            return
        }

        Remove-Item $modelPath -Force
        Write-ColorOutput "Existing model deleted." Yellow
    }

    # Download model
    Write-ColorOutput "`nDownloading $($ModelKey.ToUpper()) model..." Blue
    Write-Host "Size: $($model.Size)"
    Write-ColorOutput "From: $($model.Url)`n" Cyan

    try {
        # Use WebClient for progress reporting
        $webClient = New-Object System.Net.WebClient

        # Register progress event
        Register-ObjectEvent -InputObject $webClient -EventName DownloadProgressChanged -SourceIdentifier WebClient.DownloadProgressChanged -Action {
            $percent = $EventArgs.ProgressPercentage
            $downloaded = [math]::Round($EventArgs.BytesReceived / 1MB, 2)
            $total = [math]::Round($EventArgs.TotalBytesToReceive / 1MB, 2)

            $bar = "█" * [math]::Floor($percent / 2) + "░" * (50 - [math]::Floor($percent / 2))
            Write-Progress -Activity "Downloading model" -Status "$percent% - $downloaded MB / $total MB" -PercentComplete $percent
        } | Out-Null

        # Download file
        $webClient.DownloadFile($model.Url, $modelPath)

        # Unregister event
        Unregister-Event -SourceIdentifier WebClient.DownloadProgressChanged
        $webClient.Dispose()

        Write-Progress -Activity "Downloading model" -Completed

        # Verify download
        $fileInfo = Get-Item $modelPath
        $sizeInMB = [math]::Round($fileInfo.Length / 1MB, 2)

        Write-ColorOutput "`n✓ Download complete!" Green
        Write-ColorOutput "✓ Model saved to: $modelPath" Green
        Write-ColorOutput "✓ File size: $sizeInMB MB" Green

    } catch {
        Write-ColorOutput "`n✗ Download failed: $_" Red
        if (Test-Path $modelPath) {
            Remove-Item $modelPath -Force
        }
        exit 1
    }
}

function Show-CompletionMessage {
    param(
        [string]$ModelKey
    )

    Write-ColorOutput "`n======================================================================" Green
    Write-ColorOutput "Setup Complete!" Green
    Write-ColorOutput "======================================================================" Green

    Write-ColorOutput "`n✓ Whisper model '$ModelKey' is ready to use." Green
    Write-ColorOutput "`nTo start the application:" White
    Write-ColorOutput "  npm start" Cyan

    Write-Host "`nThe application will automatically use the downloaded model."

    if ($ModelKey -ne "medium") {
        Write-ColorOutput "`nNote: You downloaded the '$ModelKey' model." Yellow
        Write-ColorOutput "The application is configured to use 'medium' by default." Yellow
        Write-ColorOutput "Update WhisperService.ts if you want to use a different model." Yellow
    }

    Write-ColorOutput "`n======================================================================" Green
}

# Main script
try {
    Write-ColorOutput "`n======================================================================" Blue
    Write-ColorOutput "Whisper Model Setup Tool" Blue
    Write-ColorOutput "======================================================================`n" Blue

    # Create models directory if it doesn't exist
    if (-not (Test-Path $ModelsDir)) {
        New-Item -ItemType Directory -Path $ModelsDir -Force | Out-Null
        Write-ColorOutput "✓ Created directory: $ModelsDir" Green
    }

    # Check GPU support
    Test-GPUSupport | Out-Null

    # If no model specified, show menu
    if (-not $Model -or $Model -eq "") {
        Show-AvailableModels

        $Model = Read-Host "`nWhich model do you want to download? [medium]"
        if (-not $Model -or $Model -eq "") {
            $Model = "medium"
        }
    }

    # Download the model
    Download-Model -ModelKey $Model.ToLower()

    # Show completion message
    Show-CompletionMessage -ModelKey $Model.ToLower()

} catch {
    Write-ColorOutput "`nFatal error: $_" Red
    Write-Host $_.ScriptStackTrace
    exit 1
}
