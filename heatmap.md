##Beauty of Randomness - heatmaps


<img src="images/heatmap/heatmap_Spectral.png?raw=true">
<img src="images/heatmap/heatmap_yellow.png?raw=true">
<img src="images/heatmap/heatmap_PiYG.png?raw=true">

```
import numpy as np
import matplotlib.pyplot as plt
import random
```

```
data = np.random.randn(30, 30)
```

```
fig, ax = plt.subplots(figsize=(20,15))
ax.axis('off')
plt.imshow(data, cmap='YlOrBr')
```

```
fig, ax = plt.subplots(figsize=(20,15))
ax.axis('off')
plt.imshow(data, cmap='Spectral')
```

```
fig, ax = plt.subplots(figsize=(20,15))
ax.axis('off')
plt.imshow(data, cmap='PiYG')
```
