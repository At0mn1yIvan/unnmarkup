from django.db import models


class Diseases(models.Model):
    name = models.CharField(max_length=255, null=False)
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, db_index=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["name", "parent"],
                name="unique_disease_name_per_parent"
            )
        ]

    def __str__(self):
        return self.name
