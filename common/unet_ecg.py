import torch.nn as nn

class UNetModel(nn.Module):
    class _TwoConvLayers(nn.Module):
        def __init__(self, in_channels, out_channels, kernel_size=9, padding=4):
            super().__init__()
            self.model = nn.Sequential(
                nn.Conv1d(in_channels, out_channels, kernel_size=kernel_size, padding=padding, bias=False),
                nn.ReLU(inplace=True),
                nn.BatchNorm1d(out_channels),
                nn.Conv1d(out_channels, out_channels, kernel_size=kernel_size, padding=padding, bias=False),
                nn.ReLU(inplace=True),
                nn.BatchNorm1d(out_channels),
            )

        def forward(self, x):
            return self.model(x)

    class _EncoderBlock(nn.Module):
        def __init__(self, in_channels, out_channels, kernel_size=9, padding=4):
            super().__init__()
            self.block = UNetModel._TwoConvLayers(in_channels, out_channels, kernel_size, padding)
            self.max_pool = nn.MaxPool1d(2)

        def forward(self, x):
            x = self.block(x)
            y = self.max_pool(x)

            return y, x # y - down, x - skip connection

    class _DecoderBlock(nn.Module):
        def __init__(self, in_channels, out_channels, kernel_size=2, padding=4):
            super().__init__()
            self.transpose = nn.ConvTranspose1d()