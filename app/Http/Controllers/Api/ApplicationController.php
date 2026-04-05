<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Services\PusherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ApplicationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Application::ownershipAware()
            ->with(['creator:id,name', 'updater:id,name'])
            ->orderByDesc('id');

        if ($request->filter === 'active') {
            $query->where('enabled', true);
        } elseif ($request->filter === 'inactive') {
            $query->where('enabled', false);
        }

        if ($request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('id', 'like', "%{$search}%")
                  ->orWhere('key', 'like', "%{$search}%");
            });
        }

        return response()->json($query->paginate($request->per_page ?? 15));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'    => ['required', 'string', 'max:100', 'unique:applications,name'],
            'enabled' => ['required', 'boolean'],
        ]);

        $data['key']        = md5(Str::random(32));
        $data['secret']     = md5(Str::random(32));
        $data['webhooks']   = [];
        $data['created_by'] = auth()->id();

        $app = Application::create($data);

        return response()->json($app->load(['creator:id,name', 'updater:id,name']), 201);
    }

    public function show(Application $application): JsonResponse
    {
        $this->authorizeOwnership($application);

        return response()->json($application->load(['creator:id,name', 'updater:id,name']));
    }

    public function update(Request $request, Application $application): JsonResponse
    {
        $this->authorizeOwnership($application);

        $data = $request->validate([
            'name'                             => ['required', 'string', 'max:100', 'unique:applications,name,'.$application->id],
            'enabled'                          => ['boolean'],
            'enable_client_messages'           => ['boolean'],
            'enable_user_authentication'       => ['boolean'],
            'max_connections'                  => ['integer', 'min:-1'],
            'max_backend_events_per_sec'       => ['integer', 'min:-1'],
            'max_client_events_per_sec'        => ['integer', 'min:-1'],
            'max_read_req_per_sec'             => ['integer', 'min:-1'],
            'max_channel_name_length'          => ['integer', 'min:1', 'max:127'],
            'max_event_name_length'            => ['integer', 'min:1', 'max:127'],
            'max_presence_members_per_channel' => ['integer', 'min:-1', 'max:127'],
            'max_event_channels_at_once'       => ['integer', 'min:1', 'max:127'],
            'max_event_batch_size'             => ['integer', 'min:10', 'max:127'],
            'max_presence_member_size_in_kb'   => ['integer', 'min:10', 'max:127'],
            'max_event_payload_in_kb'          => ['integer', 'min:10', 'max:127'],
            'webhooks'                         => ['nullable', 'array'],
            'webhooks.*.url'                   => ['required', 'url', 'max:100'],
            'webhooks.*.event_types'           => ['required', 'array'],
            'webhooks.*.headers'               => ['nullable', 'array'],
            'webhooks.*.filter'                => ['nullable', 'array'],
            'created_by'                       => ['nullable', 'integer', 'exists:users,id'],
        ]);

        // Only admins can reassign ownership
        if (! auth()->user()->is_admin) {
            unset($data['created_by']);
        }

        $data['updated_by'] = auth()->id();

        $application->update($data);
        $application->clearCache();

        return response()->json($application->fresh()->load(['creator:id,name', 'updater:id,name']));
    }

    public function channels(Application $application): JsonResponse
    {
        $this->authorizeOwnership($application);

        $options = config('broadcasting.connections.pusher.options');

        $pusher = app(PusherService::class)->make($application->key, $application->secret, $application->id, $options);

        try {
            $result = $pusher->get('/channels');
            $channels = array_keys((array) ($result->channels ?? new \stdClass()));
        } catch (\Throwable) {
            $channels = [];
        }

        return response()->json(['channels' => $channels]);
    }

    public function destroy(Application $application): JsonResponse
    {
        $this->authorizeOwnership($application);
        $application->delete();

        return response()->json(['ok' => true]);
    }

    public function toggle(Application $application): JsonResponse
    {
        $this->authorizeOwnership($application);

        $application->update([
            'enabled'    => ! $application->enabled,
            'updated_by' => auth()->id(),
        ]);
        $application->clearCache();

        return response()->json(['enabled' => $application->enabled]);
    }

    public function stats(): JsonResponse
    {
        $query = Application::ownershipAware();

        return response()->json([
            'total'    => (clone $query)->count(),
            'active'   => (clone $query)->where('enabled', true)->count(),
            'inactive' => (clone $query)->where('enabled', false)->count(),
        ]);
    }

    private function authorizeOwnership(Application $application): void
    {
        if (auth()->user()->is_admin) {
            return;
        }

        if ($application->created_by !== auth()->id()) {
            abort(403);
        }
    }
}
