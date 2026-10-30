import torch
from pathlib import Path
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
from torchvision import datasets, transforms
from torch.utils.data import DataLoader


# Check device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print("Using device:", device)

if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))


# Load pretrained EfficientNet-B0
weights = EfficientNet_B0_Weights.DEFAULT

model = efficientnet_b0(weights=weights)


# Freeze the feature extraction layers
for parameter in model.features.parameters():
    parameter.requires_grad = False


# Number of classes in our project
num_classes = 4


# Replace the original classifier
input_features = model.classifier[1].in_features

model.classifier[1] = torch.nn.Linear(
    input_features,
    num_classes
)


# Move model to GPU
model = model.to(device)


print("\nModel successfully loaded.")
print("Number of classes:", num_classes)
print("Classifier:", model.classifier)


# --------------------------------------------------
# 8. Image preprocessing
# --------------------------------------------------

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])

# --------------------------------------------------
# 9. Load training dataset
# --------------------------------------------------

train_dataset = datasets.ImageFolder(
    "dataset/training",
    transform=transform
)

# --------------------------------------------------
# 10. Create DataLoader
# --------------------------------------------------

train_loader = DataLoader(
    train_dataset,
    batch_size=16,
    shuffle=True
)

# --------------------------------------------------
# 11. Display dataset information
# --------------------------------------------------

print("\nDataset successfully loaded.")

print("Number of training images:", len(train_dataset))

print("Dataset classes:")
print(train_dataset.classes)

print("Class mapping:")
print(train_dataset.class_to_idx)

# --------------------------------------------------
# 12. Load validation dataset
# --------------------------------------------------

validation_dataset = datasets.ImageFolder(
    "dataset/validation",
    transform=transform
)

# --------------------------------------------------
# 13. Load test dataset
# --------------------------------------------------

test_dataset = datasets.ImageFolder(
    "dataset/testing",
    transform=transform
)

# --------------------------------------------------
# 14. Create DataLoaders
# --------------------------------------------------

validation_loader = DataLoader(
    validation_dataset,
    batch_size=16,
    shuffle=False
)

test_loader = DataLoader(
    test_dataset,
    batch_size=16,
    shuffle=False
)

# --------------------------------------------------
# 15. Display dataset information
# --------------------------------------------------

print("\nDataset sizes:")
print("Training:", len(train_dataset))
print("Validation:", len(validation_dataset))
print("Test:", len(test_dataset))

print("\nValidation classes:")
print(validation_dataset.classes)

print("\nTest classes:")
print(test_dataset.classes)

# --------------------------------------------------
# 16. Define loss function
# --------------------------------------------------

criterion = torch.nn.CrossEntropyLoss()

# --------------------------------------------------
# 17. Define optimizer
# --------------------------------------------------

optimizer = torch.optim.Adam(
    model.classifier.parameters(),
    lr=0.001
)

print("\nLoss function:", criterion)
print("Optimizer:", optimizer)

# --------------------------------------------------
# 18. Training settings
# --------------------------------------------------

num_epochs = 10

# --------------------------------------------------
# 19. Training loop
# --------------------------------------------------

for epoch in range(num_epochs):

    model.train()

    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in train_loader:

        # Move images and labels to GPU/CPU
        images = images.to(device)
        labels = labels.to(device)

        # Clear previous gradients
        optimizer.zero_grad()

        # Forward pass
        outputs = model(images)

        # Calculate loss
        loss = criterion(outputs, labels)

        # Backward pass
        loss.backward()

        # Update classifier weights
        optimizer.step()

        # Track statistics
        running_loss += loss.item()

        _, predicted = torch.max(outputs, 1)

        total += labels.size(0)
        correct += (predicted == labels).sum().item()

    epoch_loss = running_loss / len(train_loader)
    epoch_accuracy = 100 * correct / total

    print(
        f"Epoch [{epoch + 1}/{num_epochs}] "
        f"Loss: {epoch_loss:.4f} "
        f"Accuracy: {epoch_accuracy:.2f}%"
    )

    # --------------------------------------------------
# 20. Validation
# --------------------------------------------------

model.eval()

validation_correct = 0
validation_total = 0

with torch.no_grad():

    for images, labels in validation_loader:

        images = images.to(device)
        labels = labels.to(device)

        outputs = model(images)

        _, predicted = torch.max(outputs, 1)

        validation_total += labels.size(0)
        validation_correct += (predicted == labels).sum().item()

validation_accuracy = 100 * validation_correct / validation_total

print(
    f"\nValidation Accuracy: {validation_accuracy:.2f}%"
)

# --------------------------------------------------
# 21. Save trained model
# --------------------------------------------------

Path("model").mkdir(parents=True, exist_ok=True)

torch.save(
    model.state_dict(),
    "model/efficientnet_b0_rice_pest.pth"
)

print("\nModel saved successfully.")

# --------------------------------------------------
# 22. Test the trained model
# --------------------------------------------------

model.eval()

test_correct = 0
test_total = 0

with torch.no_grad():

    for images, labels in test_loader:

        images = images.to(device)
        labels = labels.to(device)

        outputs = model(images)

        _, predicted = torch.max(outputs, 1)

        test_total += labels.size(0)
        test_correct += (predicted == labels).sum().item()

test_accuracy = 100 * test_correct / test_total

print(
    f"\nTest Accuracy: {test_accuracy:.2f}%"
)
