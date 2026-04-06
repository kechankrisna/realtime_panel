<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        $query = User::with(['creator:id,name', 'updater:id,name'])
            ->orderBy('name');

        if ($request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        return response()->json($query->paginate($request->per_page ?? 15));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', User::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:100', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:100'],
            'is_active' => ['boolean'],
            'is_admin' => ['boolean'],
        ]);

        $data['created_by'] = auth()->id();

        $user = User::create($data);

        return response()->json($user->load(['creator:id,name']), 201);
    }

    public function show(User $user): JsonResponse
    {
        $this->authorize('view', $user);

        return response()->json($user->load(['creator:id,name', 'updater:id,name']));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:100', 'unique:users,email,'.$user->id],
            'password' => ['nullable', 'string', 'min:8', 'max:100'],
            'is_active' => ['boolean'],
            'is_admin' => ['boolean'],
        ]);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        // Prevent editing own active/admin status
        if (auth()->id() === $user->id) {
            unset($data['is_active'], $data['is_admin']);
        }

        $data['updated_by'] = auth()->id();

        $user->update($data);

        return response()->json($user->fresh()->load(['creator:id,name', 'updater:id,name']));
    }

    public function destroy(User $user): JsonResponse
    {
        $this->authorize('delete', $user);
        $user->delete();

        return response()->json(['ok' => true]);
    }
}
