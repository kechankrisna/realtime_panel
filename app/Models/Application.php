<?php

namespace App\Models;

use App\Contracts\WebSocketServerContract;
use App\Traits\HasOwnership;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Application extends Model
{
    use HasFactory;
    use HasOwnership;

    protected $casts = [
        'webhooks' => 'array',
    ];

    public function clearCache(): void
    {
        app(WebSocketServerContract::class)->clearAppCache($this);
    }

    public function injectMonitorWebhook(): void
    {
        $url = rtrim(config('app.internal_url'), '/').'/api/webhooks/soketi/'.$this->id;
        $webhooks = $this->webhooks ?? [];

        $alreadyInjected = collect($webhooks)->contains(
            fn ($w) => ($w['url'] ?? null) === $url && empty($w['filter'])
        );

        if ($alreadyInjected) {
            return;
        }

        $webhooks[] = [
            'url' => $url,
            'event_types' => [
                'channel_occupied',
                'channel_vacated',
                'member_added',
                'member_removed',
                'client_event',
            ],
        ];

        $this->update(['webhooks' => $webhooks]);
        $this->clearCache();
    }
}
