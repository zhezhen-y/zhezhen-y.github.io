## Imitate Mondrian 
Imitate Mondrian is a sciart project of re-creating Mondrian's artwork using Python.  
In this project, I used Python libraries and functions to make plots that mimick his artwork, and recorded the process in my [Jupyter Notebook](https://github.com/zhezhen-y/sciart/blob/main/imitate_mondrian_new_york.ipynb).

<img src="images/imitate_new_york.png?raw=true">

## Mondrian who?
[Piet Mondrian](https://en.wikipedia.org/wiki/Piet_Mondrian) is one of the most influential abstract artist.   
Many of his work is made of artistic combinations of lines and squares, such as in his famous [*New York City* painting](https://en.wikipedia.org/wiki/New_York_City_(painting)).

## Minimal python code needed for this project:
### First thing first - let's import some useful python libraries!
The original artwork is consist of 3 interwined layers of lines, with the yellow lines as the topmost layer.   
I wanted to randomly generate some offsets to determine the positions of the lines on the plots, and use matplotlib to draw the lines.   
Here, numpy and matplotlib are used.

```
import numpy as np  
import matplotlib.pyplot as plt
```
### Then, define two functions that would roll the dice for the positions of lines on the plot.

The ramdom_offsets samples numbers from a random distribution.    
Those numbers are later used to generate the offsets of vertical lines in the plots.    
The uniform_offsets samples numbers from a uniform distribution, which are later used as offsets of the horizontal lines in the plots.

```
# num is the total number of offsets.
def random_offsets(num):
    # Draw random samples from a normal (Gaussian) distribution.
    # The the mean is 20 and the standard deviation is 60.
    x = 20 + np.random.normal(0, 60, num)
    return x
    
def uniform_offsets(num,umin,umax):
    # Draw samples from a uniform distribution.
    u = np.random.uniform(umin,umax,num)
    return u
```
### Next, define a function that roll the dices for all three layers of lines.
```
def mondrian_offsets(set1=2,set2=2,set3=8):
    # Make empty list to store the 3 sets of randomly sampled offsets.
    voffsets_list = []
    hoffsets_list = []
    # Roll the dice for voffsets in the uppermost layer. 
    voffsets3 = random_offsets(set3)
    # Define some boundaries by voffsets.
    left = min(voffsets3)+ 30
    right = max(voffsets3) + 30
    # Roll the dice for hoffsets.
    hoffsets3 = uniform_offsets(set3,left-34,right-35)
    # Determine the upper and lower boundaries by hoffsets.
    bottom = min(hoffsets3) + 30
    up = max(hoffsets3) + 30
    # Sample from the bottom two layers and record the offsets in the lists.
    for num in [set1,set2]:
        voffsets = random_offsets(num)
        hoffsets = uniform_offsets(num,left,right)
        voffsets_list.append(voffsets)
        hoffsets_list.append(hoffsets)
    # Append the offsets of the uppermost layer in the end.
    voffsets_list.append(voffsets3)
    hoffsets_list.append(hoffsets3)
    # Record the boundaries of the lines, later used in vline/hline arguments. 
    # Define the bounds as a tuple for easy unpacking.
    bounds = (left,right,bottom,up)
    return voffsets_list,hoffsets_list,bounds
```
### Finally, define the function that makes the plot.
```
def imitate_new_york(palette = ['#d61d18','#413f6f','#fada00'], linewidth = 30):
    # roll the dice
    mondrian_offsets(set1=2,set2=2,set3=10)
    # assign values to variables
    voffsets_list, hoffsets_list, bounds = mondrian_offsets(set1=2,set2=2,set3=10)
    left,right,bottom,up = bounds
    # make the plot
    fig, ax = plt.subplots(figsize=(20,15), facecolor = '#f0f5f1')
    ax.axis('off')
    for i, c in enumerate(palette):
        # bottom,up: Respective beginning and end of each verticle line.
        plt.vlines(voffsets_list[i],bottom,up, linewidth=linewidth, color=c)
        # left,right: Respective beginning and end of each vhorizontal line.
        plt.hlines(hoffsets_list[i],left,right, linewidth=linewidth, color=c)
    ax.set_xlim([left,right])
    ax.set_ylim([bottom,up])
    plt.show()
```
### Run the function to actually generate the plot.
```
imitate_new_york()
```

For a full detailed process of how the functions evolve, check out my [Jupyter Notebook](https://github.com/zhezhen-y/sciart/blob/main/imitate_mondrian_new_york.ipynb).

[< Back to main page](index.md)
