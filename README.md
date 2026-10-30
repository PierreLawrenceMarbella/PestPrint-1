# PESTPRINT

A rice crop image analysis system. Upload a crop photo to see the model’s prediction and confidence score.

The AI predicts Healthy Rice, Stem Borer Damage, Rice Leaffolder Damage, or Unknown (Other Damage).

## Requirements

- Windows PowerShell
- Python 3.11
- Node.js 22.12 or newer
- The trained model file `efficientnet_b0_rice_pest.pth`, saved inside the project’s `model` folder

## Required Project Files

The application source code is included in the GitHub repository. These additional files are not:

```text
PestPrint/
├── model/
│   └── efficientnet_b0_rice_pest.pth   Required to run image analysis
└── dataset/                           Required only to train or evaluate
    ├── training/
    │   ├── healthy/
    │   ├── leaffolder/
    │   ├── stemborer/
    │   └── unknown/
    ├── validation/                    Same four class folders
    └── testing/                       Same four class folders
```

Get the trained `.pth` file and dataset from your group’s shared storage. Place them in the folders shown above. If you do not have the model file, train it using the instructions below. Do not commit the model or dataset to GitHub; they are excluded from the repository because of their size.

## First-Time Setup (Run Once)

Run these steps after downloading or cloning the project to a new computer. Open PowerShell in the **PestPrint** project folder, then copy and run the commands below. You only need to do this once on that computer.

```powershell
# Create a Python environment for this project
python -m venv .venv

# Activate the environment in PowerShell
.\.venv\Scripts\Activate.ps1

# Install the Python packages
python -m pip install -r requirements.txt

# Install the website packages and prepare the website
cd frontend
npm.cmd install
npm.cmd run build
cd ..
```

Do not repeat these steps every time you open the website. If you have already set up the project and `.venv` on this computer, go straight to **Start the System**.

## Train the Model (If Needed)

Training requires a dataset with `training`, `validation`, and `testing` folders. Each folder must contain `healthy`, `leaffolder`, `stemborer`, and `unknown` subfolders. Activate `.venv` in PowerShell from the project folder, then run:

```powershell
python train.py
```

This saves the trained model to `model/efficientnet_b0_rice_pest.pth`. The first run may need internet to download pretrained weights. Skip training if your group already gave you the `.pth` file.

## Evaluate the Model

After training, with `.venv` activated, evaluate the saved model with the testing dataset:

```powershell
python test.py
```

This displays the model's test results. It requires the trained `.pth` file and `dataset/testing/`.

## Start the System

Whenever you open a new PowerShell window, activate the environment from the project folder, then start the app:

```powershell
.\.venv\Scripts\Activate.ps1
python app.py
```

Open **http://127.0.0.1:5000** in your browser. Press **Ctrl+C** in PowerShell to stop the system.
