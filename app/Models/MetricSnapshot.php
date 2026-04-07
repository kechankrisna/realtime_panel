<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MetricSnapshot extends Model
{
    use HasFactory;

    public $timestamps = false;

    public $incrementing = false;

    protected $primaryKey = null;

    protected $casts = [
        'recorded_at' => 'datetime',
    ];

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }
}
